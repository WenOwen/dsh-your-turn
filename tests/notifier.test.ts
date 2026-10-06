/**
 * @vitest-environment jsdom
 *
 * The reminder pipeline against real browser globals: filtering gates, sound
 * selection, the queue, snooze persistence, legacy-state migration, cross-tab de-duplication,
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
  // The attention gate and self-dismissal are off by default so each test
  // states the filter it is actually about; the tests that exercise the gate
  // or the auto-dismiss timer opt back in.
  const settings = fakeSettings({ onlyWhenUnfocused: false, autoDismissSeconds: 0, ...overrides })
  const sound = new FakeSound()
  const notifier = new Notifier(CONTEXT, settings.controller, sound as unknown as SoundEngine, () => undefined)
  return { notifier, sound, settings }
}

/** Force the visibility state a test needs. */
function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

/**
 * Build the configuration an older settings document would produce: the
 * attention gate off, plus whatever retired fields the test names. Removed
 * fields are dropped by `normalizeConfig`, which is exactly the behaviour under
 * test — they must not switch anything off.
 */
function legacySettings(fields: Record<string, unknown> = {}): Partial<YourTurnConfig> {
  return normalizeConfig({ onlyWhenUnfocused: false, ...fields })
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
  it('reminds even when a legacy master switch says off', () => {
    const { notifier, sound } = build(legacySettings({ enabled: false }))
    notifier.consider(record())
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    expect(sound.played).toHaveLength(1)
    notifier.dispose()
  })

  it('never reminds for a subagent session', () => {
    const { notifier, sound } = build(legacySettings({ includeSubagents: true }))
    notifier.consider(record({ subagent: true }))
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    expect(sound.played).toEqual([])
    notifier.dispose()
  })

  it.each([0, 1, 1000])('reminds even for a %d ms turn with a legacy minimum-duration setting', (durationMs) => {
    const { notifier, sound } = build(normalizeConfig({ minTurnSeconds: 3600, onlyWhenUnfocused: false }))
    notifier.consider(record({ durationMs }))
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    expect(sound.played).toHaveLength(1)
    notifier.dispose()
  })

  it.each(['completed', 'failed', 'aborted', 'limited', 'unknown'] as const)(
    'raises a reminder for the %s outcome',
    (outcome) => {
      const { notifier, sound } = build()
      notifier.consider(record({ outcome }))
      expect(notifier.state.getSnapshot().reminders).toMatchObject([{ outcome }])
      expect(sound.played).toHaveLength(1)
      notifier.dispose()
    },
  )

  it('stays silent while the page is attended, when asked to', () => {
    const { notifier } = build({ onlyWhenUnfocused: true })
    notifier.consider(record())
    expect(notifier.state.getSnapshot().reminders).toEqual([])

    setFocus(false)
    notifier.consider(record({ endedAt: 20_000 }))
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    notifier.dispose()
  })

  it.each(['completed', 'failed', 'aborted', 'limited', 'unknown'] as const)(
    'ignores legacy notifyOn, muteAll and quiet-hours settings for %s',
    (outcome) => {
      // Normalize old stored fields instead of spreading them onto an effective Config.
      const config = normalizeConfig({
        notifyOn: 'success', muteAll: true,
        quietHoursEnabled: true, quietHoursStart: '11:00', quietHoursEnd: '13:00',
        onlyWhenUnfocused: false,
      })
      const { notifier, sound } = build(config)
      notifier.consider(record({ outcome }))
      expect(notifier.state.getSnapshot().reminders).toMatchObject([{ outcome }])
      expect(sound.played).toHaveLength(1)
      notifier.dispose()
    },
  )
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

  it('dismisses a reminder by itself after the configured delay', () => {
    const { notifier } = build({ autoDismissSeconds: 5 })
    notifier.consider(record())
    vi.advanceTimersByTime(4_999)
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    notifier.dispose()
  })

  it('clocks each queued reminder from its own raise', () => {
    const { notifier } = build({ autoDismissSeconds: 5 })
    notifier.consider(record())
    vi.advanceTimersByTime(2_000)
    notifier.consider(record({ sessionId: 'b', endedAt: 20_000 }))
    vi.advanceTimersByTime(3_000)
    // Five seconds in, the first reminder is gone; the second has two left.
    expect(notifier.state.getSnapshot().reminders.map((r) => r.sessionId)).toEqual(['b'])
    vi.advanceTimersByTime(2_000)
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    notifier.dispose()
  })

  it('keeps a reminder when auto-dismiss is turned off while it is up', () => {
    const { notifier, settings } = build({ autoDismissSeconds: 2 })
    notifier.consider(record())
    settings.snapshot.set({
      ...settings.snapshot.getSnapshot(),
      config: normalizeConfig({ onlyWhenUnfocused: false, autoDismissSeconds: 0 }),
    })
    vi.advanceTimersByTime(10_000)
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    notifier.dispose()
  })

  it('a snoozed reminder self-dismisses from its re-raise', () => {
    const { notifier } = build({ autoDismissSeconds: 5 })
    notifier.consider(record())
    notifier.snooze(notifier.state.getSnapshot().reminders[0]!.id)
    vi.advanceTimersByTime(5 * 60_000)
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    vi.advanceTimersByTime(5_000)
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    notifier.dispose()
  })

  it('keeps a reminder indefinitely when auto-dismiss is off', () => {
    const { notifier } = build()
    notifier.consider(record())
    vi.advanceTimersByTime(10 * 60_000)
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    notifier.dispose()
  })

  it('keeps both displayed and queued reminders until each is manually dismissed', () => {
    const { notifier } = build()
    notifier.consider(record())
    notifier.consider(record({ sessionId: 'b', endedAt: 20_000 }))
    vi.advanceTimersByTime(24 * 60 * 60_000)
    expect(notifier.state.getSnapshot().reminders.map((r) => r.sessionId)).toEqual(['session-a', 'b'])
    notifier.dismiss(notifier.state.getSnapshot().reminders[0]!.id)
    vi.advanceTimersByTime(24 * 60 * 60_000)
    expect(notifier.state.getSnapshot().reminders.map((r) => r.sessionId)).toEqual(['b'])
    notifier.dismissAll()
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

describe('Notifier snooze and legacy local state', () => {
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

  it('ignores a legacy muted session and never republishes or persists the mute list', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mutedSessions: ['session-a'], snoozeUntil: {} }))
    const { notifier, sound } = build()
    expect(notifier.state.getSnapshot()).not.toHaveProperty('mutedSessions')
    notifier.consider(record())
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    expect(sound.played).toHaveLength(1)
    notifier.snooze(notifier.state.getSnapshot().reminders[0]!.id)
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
    expect(saved).not.toHaveProperty('mutedSessions')
    expect(saved.snoozeUntil).toEqual({ 'session-a': Date.now() + SNOOZE_MS })
    vi.advanceTimersByTime(SNOOZE_MS)
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
    expect(sound.played).toHaveLength(2)
    notifier.dispose()
  })
})

describe('question sounds', () => {
  it('sounds even in the foreground, without another modal', () => {
    const { notifier, sound } = build({ onlyWhenUnfocused: true })
    notifier.considerQuestion({ sessionId: 'a', key: 'question:1', subagent: false })
    expect(sound.played).toHaveLength(1)
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    notifier.considerQuestion({ sessionId: 'a', key: 'question:1', subagent: false })
    expect(sound.played).toHaveLength(1)
    notifier.considerQuestion({ sessionId: 'a', key: 'question:2', subagent: false })
    expect(sound.played).toHaveLength(2)
    notifier.dispose()
  })
  it('respects the sound switch and the subagent exclusion', () => {
    const silent = build({ soundEnabled: false })
    silent.notifier.considerQuestion({ sessionId: 'a', key: 'one', subagent: false })
    expect(silent.sound.played).toEqual([])
    silent.notifier.dispose()

    const heard = build()
    heard.notifier.considerQuestion({ sessionId: 'a', key: 'two', subagent: false })
    expect(heard.sound.played).toHaveLength(1)
    heard.notifier.dispose()

    const subagent = build(legacySettings({ includeSubagents: true }))
    subagent.notifier.considerQuestion({ sessionId: 'b', key: 'three', subagent: true })
    expect(subagent.sound.played).toEqual([])
    subagent.notifier.dispose()
  })
  it('ignores legacy quiet-hours, master-mute, outcome and session-mute settings for questions', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mutedSessions: ['a'], snoozeUntil: {} }))
    const config = normalizeConfig({
      muteAll: true, notifyOn: 'success', quietHoursEnabled: true,
      quietHoursStart: '11:00', quietHoursEnd: '13:00',
    })
    const { notifier, sound } = build(config)
    notifier.considerQuestion({ sessionId: 'a', key: 'one', subagent: false })
    expect(sound.played).toHaveLength(1)
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    notifier.dispose()
  })
  it('suppresses a question another tab has announced without suppressing turn-end reminders', () => {
    const { notifier, sound } = build()
    FakeChannel.instances.at(-1)!.deliver({ kind: 'question', key: 'a:one', at: Date.now() })
    notifier.considerQuestion({ sessionId: 'a', key: 'one', subagent: false })
    expect(sound.played).toEqual([])
    notifier.consider(record({ sessionId: 'a' }))
    expect(sound.played).toHaveLength(1)
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
