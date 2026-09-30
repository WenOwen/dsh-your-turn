/**
 * @vitest-environment jsdom
 *
 * The reminder pipeline against real browser globals: filtering gates, sound
 * selection, the queue, snooze and mute persistence, cross-tab de-duplication,
 * and the title flash. The settings source and the audio engine are fakes, so
 * every assertion is about what the notifier decided or did.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { normalizeConfig, type YourTurnConfig } from '../src/shared/settings.ts'
import { STORAGE_KEY, type LocalState } from '../src/client/localState.ts'
import { Notifier, SNOOZE_MS, pageAttended } from '../src/client/notifier.ts'
import { Observable } from '../src/client/observable.ts'
import type { ResolvedSettings, SettingsController } from '../src/client/settings.ts'
import type { SoundEngine } from '../src/client/sound.ts'
import type { TurnEndRecord } from '../src/client/turnWatcher.ts'

/** A scripted audio engine. */
class FakeSound {
  readonly played: { preset: string; volume: number }[] = []
  unlocked = false

  play(preset: string, volume: number): void {
    this.played.push({ preset, volume })
  }

  isUnlocked(): boolean {
    return this.unlocked
  }

  async unlock(): Promise<boolean> {
    this.unlocked = true
    return true
  }
}

/** A scripted settings source. */
function fakeSettings(overrides: Partial<YourTurnConfig> = {}): {
  controller: SettingsController
  snapshot: Observable<ResolvedSettings>
} {
  const snapshot = new Observable<ResolvedSettings>({
    config: normalizeConfig(overrides),
    status: 'ready',
    writable: true,
  })
  const controller = {
    snapshot,
    get config(): YourTurnConfig {
      return snapshot.getSnapshot().config
    },
    dispose: () => undefined,
  } as unknown as SettingsController
  return { controller, snapshot }
}

/** A scripted `BroadcastChannel`, since jsdom does not ship one. */
class FakeChannel {
  static readonly instances: FakeChannel[] = []
  onmessage: ((event: MessageEvent) => void) | undefined
  readonly posted: unknown[] = []
  closed = false

  constructor(readonly name: string) {
    FakeChannel.instances.push(this)
  }

  postMessage(message: unknown): void {
    this.posted.push(message)
  }

  /** Deliver a message as if another tab sent it. */
  deliver(message: unknown): void {
    this.onmessage?.({ data: message } as MessageEvent)
  }

  close(): void {
    this.closed = true
  }
}

/** Build one observed handoff. */
function record(overrides: Partial<TurnEndRecord> = {}): TurnEndRecord {
  return {
    sessionId: 'session-a',
    title: 'Refactor auth',
    cwd: 'D:/work/auth',
    subagent: false,
    startedAt: 0,
    endedAt: 10_000,
    durationMs: 10_000,
    turn: 3,
    outcome: 'completed',
    reasonKind: 'completed',
    ...overrides,
  }
}

const CONTEXT = { get: () => undefined } as unknown as Context

/** Build a notifier over fakes, plus the pieces a test inspects. */
function build(overrides: Partial<YourTurnConfig> = {}): {
  notifier: Notifier
  sound: FakeSound
  settings: ReturnType<typeof fakeSettings>
} {
  // The attention gate is off by default so each test states the filter it is
  // actually about; the tests that exercise the gate opt back in.
  const settings = fakeSettings({ onlyWhenUnfocused: false, ...overrides })
  const sound = new FakeSound()
  const notifier = new Notifier(CONTEXT, settings.controller, sound as unknown as SoundEngine, () => undefined)
  return { notifier, sound, settings }
}

/** Force the visibility state a test needs. */
function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

/** Force window focus a test needs. */
function setFocus(focused: boolean): void {
  Object.defineProperty(document, 'hasFocus', { value: () => focused, configurable: true })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-04T12:00:00'))
  FakeChannel.instances.length = 0
  ;(globalThis as unknown as { BroadcastChannel?: unknown }).BroadcastChannel =
    FakeChannel as unknown as typeof BroadcastChannel
  localStorage.clear()
  document.title = 'DeepSeek Harness'
  setVisibility('visible')
  setFocus(true)
})

afterEach(() => {
  vi.useRealTimers()
  delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel
})

describe('pageAttended', () => {
  it('is false while hidden and true when visible and focused', () => {
    setVisibility('hidden')
    expect(pageAttended()).toBe(false)
    setVisibility('visible')
    setFocus(false)
    expect(pageAttended()).toBe(false)
    setFocus(true)
    expect(pageAttended()).toBe(true)
  })
})

describe('Notifier filtering', () => {
  it('raises nothing when the plugin is disabled', () => {
    const { notifier, sound } = build({ enabled: false })
    notifier.consider(record())
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    expect(sound.played).toEqual([])
    notifier.dispose()
  })

  it('raises nothing while muted', () => {
    const { notifier } = build({ muteAll: true })
    notifier.consider(record())
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    notifier.dispose()
  })

  it('skips subagent sessions unless asked for them', () => {
    const off = build({ includeSubagents: false })
    off.notifier.consider(record({ subagent: true }))
    expect(off.notifier.state.getSnapshot().reminders).toEqual([])
    off.notifier.dispose()

    const on = build({ includeSubagents: true })
    on.notifier.consider(record({ subagent: true }))
    expect(on.notifier.state.getSnapshot().reminders).toHaveLength(1)
    on.notifier.dispose()
  })

  it('skips turns shorter than the configured floor', () => {
    const { notifier } = build({ minTurnSeconds: 5 })
    notifier.consider(record({ durationMs: 4_999 }))
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    notifier.consider(record({ durationMs: 5_000 }))
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    notifier.dispose()
  })

  it('skips outcomes outside the configured scope', () => {
    const { notifier } = build({ notifyOn: 'success' })
    notifier.consider(record({ outcome: 'failed' }))
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    notifier.consider(record({ outcome: 'completed' }))
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    notifier.dispose()
  })

  it('stays silent while the page is attended, when asked to', () => {
    const { notifier } = build({ onlyWhenUnfocused: true })
    notifier.consider(record())
    expect(notifier.state.getSnapshot().reminders).toEqual([])

    setFocus(false)
    notifier.consider(record({ endedAt: 20_000 }))
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    notifier.dispose()
  })

  it('suppresses reminders inside the quiet window', () => {
    const { notifier } = build({ quietHoursEnabled: true, quietHoursStart: '11:00', quietHoursEnd: '13:00' })
    notifier.consider(record())
    expect(notifier.state.getSnapshot().reminders).toEqual([])

    vi.setSystemTime(new Date('2026-03-04T14:00:00'))
    notifier.consider(record({ endedAt: 20_000 }))
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    notifier.dispose()
  })
})

describe('Notifier effects', () => {
  it('plays the configured success and failure voices at the configured volume', () => {
    const { notifier, sound } = build({ soundPreset: 'marimba', errorSoundPreset: 'alert', volume: 35 })
    notifier.consider(record())
    notifier.consider(record({ sessionId: 'b', outcome: 'failed', endedAt: 20_000 }))
    expect(sound.played).toEqual([
      { preset: 'marimba', volume: 35 },
      { preset: 'alert', volume: 35 },
    ])
    notifier.dispose()
  })

  it('plays nothing when the chime is off', () => {
    const { notifier, sound } = build({ soundEnabled: false })
    notifier.consider(record())
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    expect(sound.played).toEqual([])
    notifier.dispose()
  })

  it('auto-dismisses after the configured delay', () => {
    const { notifier } = build({ autoDismissSeconds: 10 })
    notifier.consider(record())
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    vi.advanceTimersByTime(9_999)
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    notifier.dispose()
  })

  it('keeps a reminder until it is dismissed when the delay is zero', () => {
    const { notifier } = build({ autoDismissSeconds: 0 })
    notifier.consider(record())
    vi.advanceTimersByTime(10 * 60_000)
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    notifier.dispose()
  })

  it('times only the reminder on screen, so a queued one cannot expire unseen', () => {
    const { notifier } = build({ autoDismissSeconds: 10 })
    notifier.consider(record())
    notifier.consider(record({ sessionId: 'b', endedAt: 20_000 }))
    expect(notifier.state.getSnapshot().reminders.map((r) => r.sessionId)).toEqual(['session-a', 'b'])

    vi.advanceTimersByTime(10_000)
    expect(notifier.state.getSnapshot().reminders.map((r) => r.sessionId)).toEqual(['b'])

    // The promoted reminder gets its own full window, not the remainder of the first.
    vi.advanceTimersByTime(9_999)
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    notifier.dispose()
  })

  it('drains the queue one reminder at a time', () => {
    const { notifier } = build()
    notifier.consider(record())
    notifier.consider(record({ sessionId: 'b', endedAt: 20_000 }))
    notifier.consider(record({ sessionId: 'c', endedAt: 30_000 }))
    const ids = notifier.state.getSnapshot().reminders.map((r) => r.sessionId)
    expect(ids).toEqual(['session-a', 'b', 'c'])

    notifier.dismiss(notifier.state.getSnapshot().reminders[0]!.id)
    expect(notifier.state.getSnapshot().reminders.map((r) => r.sessionId)).toEqual(['b', 'c'])
    notifier.dismissAll()
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    notifier.dispose()
  })

  it('stops flashing the title when the queue empties', () => {
    const { notifier } = build({ flashTitle: true })
    setFocus(false)
    notifier.consider(record())
    vi.advanceTimersByTime(1_200)
    expect(document.title).toBe('● DeepSeek Harness')
    notifier.dismissAll()
    expect(document.title).toBe('DeepSeek Harness')
    notifier.dispose()
  })

  it('never flashes the title while the page is attended', () => {
    const { notifier } = build({ flashTitle: true, onlyWhenUnfocused: false })
    notifier.consider(record())
    vi.advanceTimersByTime(2_400)
    expect(document.title).toBe('DeepSeek Harness')
    notifier.dispose()
  })

  it('reports audio as unlocked once the engine resumes', async () => {
    const { notifier } = build()
    expect(notifier.state.getSnapshot().audioUnlocked).toBe(false)
    await expect(notifier.unlockAudio()).resolves.toBe(true)
    expect(notifier.state.getSnapshot().audioUnlocked).toBe(true)
    notifier.dispose()
  })

  it('plays a preview only after the resume attempt settles', async () => {
    const { notifier, sound } = build({ volume: 25 })
    notifier.preview('drop')
    expect(sound.played).toEqual([])
    await vi.advanceTimersByTimeAsync(0)
    expect(sound.played).toEqual([{ preset: 'drop', volume: 25 }])
    notifier.dispose()
  })
})

describe('Notifier snooze and mute', () => {
  it('pushes a reminder back and brings it back after the snooze', () => {
    const { notifier, sound } = build()
    notifier.consider(record())
    notifier.snooze(notifier.state.getSnapshot().reminders[0]!.id)
    expect(notifier.state.getSnapshot().reminders).toEqual([])

    vi.advanceTimersByTime(SNOOZE_MS - 1)
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    vi.advanceTimersByTime(1)
    const back = notifier.state.getSnapshot().reminders
    expect(back).toHaveLength(1)
    expect(back[0]!.snoozed).toBe(true)
    expect(sound.played).toHaveLength(2)
    notifier.dispose()
  })

  it('records the snooze window in browser storage and drops it on expiry', () => {
    const { notifier } = build()
    notifier.consider(record())
    notifier.snooze(notifier.state.getSnapshot().reminders[0]!.id)
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as LocalState
    expect(saved.snoozeUntil['session-a']).toBe(Date.now() + SNOOZE_MS)

    vi.advanceTimersByTime(SNOOZE_MS)
    const after = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as LocalState
    expect(after.snoozeUntil['session-a']).toBeUndefined()
    notifier.dispose()
  })

  it('silences one session, dismisses its reminder, and keeps it silent', () => {
    const { notifier } = build()
    notifier.consider(record())
    notifier.muteSession('session-a')
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    expect(notifier.state.getSnapshot().mutedSessions).toEqual(['session-a'])

    notifier.consider(record({ endedAt: 20_000 }))
    expect(notifier.state.getSnapshot().reminders).toEqual([])

    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as LocalState
    expect(saved.mutedSessions).toEqual(['session-a'])

    notifier.unmuteSession('session-a')
    expect(notifier.state.getSnapshot().mutedSessions).toEqual([])
    // Past the cross-tab de-duplication window, so this is a genuinely new handoff.
    vi.advanceTimersByTime(5_000)
    notifier.consider(record({ endedAt: 30_000 }))
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    notifier.dispose()
  })

  it('restores a muted session from storage into the first snapshot', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mutedSessions: ['session-a'], snoozeUntil: {} }))
    const { notifier } = build()
    expect(notifier.state.getSnapshot().mutedSessions).toEqual(['session-a'])
    notifier.consider(record())
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    notifier.dispose()
  })
})

describe('Notifier cross-tab coordination', () => {
  it('suppresses a reminder another window already raised', () => {
    const { notifier } = build()
    const channel = FakeChannel.instances.at(-1)!
    channel.deliver({ kind: 'raised', sessionId: 'session-a', at: Date.now() })
    notifier.consider(record())
    expect(notifier.state.getSnapshot().reminders).toEqual([])

    // The suppression window is short: a later handoff still raises.
    vi.advanceTimersByTime(5_000)
    notifier.consider(record({ endedAt: 40_000 }))
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    notifier.dispose()
  })

  it('announces what it raised and dismissed', () => {
    const { notifier } = build()
    const channel = FakeChannel.instances.at(-1)!
    notifier.consider(record())
    expect(channel.posted[0]).toMatchObject({ kind: 'raised', sessionId: 'session-a' })
    notifier.dismiss(notifier.state.getSnapshot().reminders[0]!.id)
    expect(channel.posted[1]).toEqual({ kind: 'dismissed', sessionId: 'session-a' })
    notifier.dispose()
  })

  it('closes its own reminder when another window dismisses it', () => {
    const { notifier } = build()
    const channel = FakeChannel.instances.at(-1)!
    notifier.consider(record())
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    channel.deliver({ kind: 'dismissed', sessionId: 'session-a' })
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    notifier.dispose()
  })

  it('ignores malformed cross-tab payloads', () => {
    const { notifier } = build()
    const channel = FakeChannel.instances.at(-1)!
    expect(() => channel.deliver(undefined)).not.toThrow()
    expect(() => channel.deliver({ kind: 'nonsense' })).not.toThrow()
    notifier.dispose()
  })

  it('closes the channel on dispose', () => {
    const { notifier } = build()
    const channel = FakeChannel.instances.at(-1)!
    notifier.dispose()
    expect(channel.closed).toBe(true)
  })
})
