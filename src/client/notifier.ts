/**
 * The reminder queue: filtering, sound, cross-tab de-duplication, and the
 * browser-level effects that sit outside React.
 *
 * One instance per plugin instance. It owns:
 *
 * - the queue the popup and the banner both drain (head first);
 * - the decision of whether a finished turn is worth interrupting for;
 * - the chime, the system notification, and the title flash;
 * - the two browser-local facts that survive a reload — silenced sessions and
 *   pushed-back reminders;
 * - telling the *other* tabs of the same origin what it just did, so three open
 *   windows raise one reminder instead of three.
 *
 * @module dsh-your-turn/client/notifier
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  clockMinutes,
  insideQuietWindow,
  outcomeInScope,
  type SoundPreset,
  type YourTurnConfig,
} from '../shared/settings.ts'
import { emptyLocalState, loadLocalState, saveLocalState, type LocalState } from './localState.ts'
import { Observable } from './observable.ts'
import type { ResolvedSettings, SettingsController } from './settings.ts'
import { resolvePreset, type SoundEngine } from './sound.ts'
import type { TurnEndRecord } from './turnWatcher.ts'

/** One raised reminder. */
export interface Reminder {
  /** Stable identity: one reminder per session handoff. */
  id: string
  /** Session the reminder points at. */
  sessionId: string
  /** Human-facing label. */
  title: string
  /** Session working directory, when known. */
  cwd: string | undefined
  /** Classified outcome of the finished turn. */
  outcome: TurnEndRecord['outcome']
  /** Turn number, when the exact record was readable. */
  turn: number | undefined
  /** Observed turn duration in milliseconds. */
  durationMs: number
  /** When the reminder entered the queue. */
  raisedAt: number
  /** Whether this reminder came back from a snooze. */
  snoozed: boolean
}

/** Everything the surfaces render. */
export interface NotifierState {
  /** Pending reminders; index 0 is the one on screen. */
  reminders: readonly Reminder[]
  /** Session ids silenced in this browser. */
  mutedSessions: readonly string[]
  /** Whether the browser has allowed audio yet. */
  audioUnlocked: boolean
}

/** How long a pushed-back reminder waits before it returns. */
export const SNOOZE_MS = 5 * 60 * 1000

/** Queue cap; beyond this the oldest pending reminder is dropped. */
const MAX_QUEUE = 20

/** Cross-tab de-duplication window. */
const DEDUPE_MS = 4000

/** Interval of the title alternation. */
const FLASH_INTERVAL_MS = 1200

/** One cross-tab announcement. */
type TabMessage =
  | { readonly kind: 'raised'; readonly sessionId: string; readonly at: number }
  | { readonly kind: 'dismissed'; readonly sessionId: string }

/** The slice of `ctx.sessions` the notifier reads for snooze re-checks. */
interface SessionsFace {
  readonly list: {
    getSnapshot(): {
      readonly byId: Readonly<Record<string, { readonly running?: boolean } | undefined>>
    }
  }
}

/**
 * Owns the reminder queue and every browser effect a reminder triggers.
 */
export class Notifier {
  /** Published state; the surfaces subscribe to this. */
  readonly state: Observable<NotifierState>

  /** Resolved configuration source, re-published to the surfaces. */
  readonly settingsSnapshot: Observable<ResolvedSettings>

  private readonly ctx: Context
  private readonly settings: SettingsController
  private readonly sound: SoundEngine
  private readonly onUnlockChange: (unlocked: boolean) => void

  private local: LocalState = emptyLocalState()
  private readonly timers = new Map<string, number>()
  private readonly snoozeTimers = new Map<string, number>()
  private readonly recentRaises = new Map<string, number>()
  private channel: BroadcastChannel | undefined
  private removeFocusListener: (() => void) | undefined
  private flashTimer: number | undefined
  private flashBase: string | undefined
  private flashOn = false
  private disposed = false

  /**
   * @param ctx - Client Cordis context.
   * @param settings - resolved configuration source.
   * @param sound - the page's chime engine.
   * @param onUnlockChange - notified when audio becomes available, so a settings
   *   page can drop its "the browser has not allowed audio yet" hint.
   */
  constructor(
    ctx: Context,
    settings: SettingsController,
    sound: SoundEngine,
    onUnlockChange: (unlocked: boolean) => void,
  ) {
    this.ctx = ctx
    this.settings = settings
    this.settingsSnapshot = settings.snapshot
    this.sound = sound
    this.onUnlockChange = onUnlockChange
    this.local = loadLocalState()
    this.state = new Observable<NotifierState>({
      reminders: [],
      mutedSessions: [...this.local.mutedSessions],
      audioUnlocked: sound.isUnlocked(),
    })
    this.openChannel()
    this.watchFocus()
  }

  /** @returns the configuration the reminder path reads. */
  private get config(): YourTurnConfig {
    return this.settings.config
  }

  /**
   * Decide whether a finished turn deserves an interruption, and raise it.
   *
   * Every gate is reported at debug level rather than silently swallowed, so a
   * "why did nothing happen" question is answerable from the console.
   *
   * @param record - the observed turn handoff.
   */
  consider(record: TurnEndRecord): void {
    if (this.disposed) return
    const config = this.config
    const skip = this.rejection(record, config)
    if (skip !== undefined) {
      console.debug(`[dsh-your-turn] ${record.sessionId}: no reminder (${skip})`)
      return
    }
    if (this.suppressedByAnotherTab(record.sessionId)) {
      console.debug(`[dsh-your-turn] ${record.sessionId}: another window already raised this reminder`)
      return
    }
    this.raise({
      id: `${record.sessionId}:${String(record.endedAt)}`,
      sessionId: record.sessionId,
      title: record.title,
      cwd: record.cwd,
      outcome: record.outcome,
      turn: record.turn,
      durationMs: record.durationMs,
      raisedAt: Date.now(),
      snoozed: false,
    })
  }

  /**
   * Remove one reminder from the queue.
   * @param id - reminder identity.
   * @param announce - whether to tell other tabs (false when they told us).
   */
  dismiss(id: string, announce = true): void {
    const current = this.state.getSnapshot()
    const target = current.reminders.find((reminder) => reminder.id === id)
    if (target === undefined) return
    this.clearTimer(id)
    this.state.set({
      ...current,
      reminders: current.reminders.filter((reminder) => reminder.id !== id),
    })
    this.afterQueueChange()
    if (announce) this.post({ kind: 'dismissed', sessionId: target.sessionId })
  }

  /** Remove every pending reminder. */
  dismissAll(): void {
    const current = this.state.getSnapshot()
    if (current.reminders.length === 0) return
    for (const reminder of current.reminders) this.clearTimer(reminder.id)
    this.state.set({ ...current, reminders: [] })
    this.afterQueueChange()
    for (const reminder of current.reminders) this.post({ kind: 'dismissed', sessionId: reminder.sessionId })
  }
  /**
   * Push one reminder back by {@link SNOOZE_MS}.
   * @param id - reminder identity.
   */
  snooze(id: string): void {
    const current = this.state.getSnapshot()
    const target = current.reminders.find((reminder) => reminder.id === id)
    if (target === undefined) return
    this.dismiss(id)
    this.local.snoozeUntil[target.sessionId] = Date.now() + SNOOZE_MS
    this.persist()
    const timer = window.setTimeout(() => {
      this.snoozeTimers.delete(target.sessionId)
      delete this.local.snoozeUntil[target.sessionId]
      this.persist()
      if (this.sessionRunning(target.sessionId)) return
      this.raise({ ...target, id: `${target.id}:snoozed`, raisedAt: Date.now(), snoozed: true })
    }, SNOOZE_MS)
    this.snoozeTimers.set(target.sessionId, timer)
  }

  /**
   * Silence one session in this browser.
   * @param sessionId - session to silence.
   */
  muteSession(sessionId: string): void {
    if (!this.local.mutedSessions.includes(sessionId)) {
      this.local.mutedSessions = [...this.local.mutedSessions, sessionId]
      this.persist()
    }
    const current = this.state.getSnapshot()
    this.state.set({ ...current, mutedSessions: [...this.local.mutedSessions] })
    for (const reminder of current.reminders.filter((entry) => entry.sessionId === sessionId)) {
      this.dismiss(reminder.id)
    }
  }

  /**
   * Undo {@link muteSession}.
   * @param sessionId - session to unmute.
   */
  unmuteSession(sessionId: string): void {
    if (!this.local.mutedSessions.includes(sessionId)) return
    this.local.mutedSessions = this.local.mutedSessions.filter((id) => id !== sessionId)
    this.persist()
    this.state.set({ ...this.state.getSnapshot(), mutedSessions: [...this.local.mutedSessions] })
  }

  /**
   * Create or resume the page's audio output.
   *
   * Safe to call from any user gesture; the settings Preview button and the
   * first pointer or key event both do.
   *
   * @returns whether audio is live afterwards.
   */
  async unlockAudio(): Promise<boolean> {
    const unlocked = await this.sound.unlock()
    if (unlocked) this.publishAudioState(true)
    return unlocked
  }

  /**
   * Play one voice now, for the settings Preview button.
   * @param preset - voice to play.
   */
  preview(preset: SoundPreset): void {
    const volume = this.config.volume
    // Play only after the resume attempt settles: a tone scheduled against a
    // suspended clock is dropped before it can be heard.
    void this.unlockAudio().then(
      () => this.sound.play(preset, volume),
      () => this.sound.play(preset, volume),
    )
  }

  /** Stop timers, close the cross-tab channel, and restore the title. */
  dispose(): void {
    this.disposed = true
    for (const id of [...this.timers.keys()]) this.clearTimer(id)
    for (const timer of this.snoozeTimers.values()) window.clearTimeout(timer)
    this.snoozeTimers.clear()
    this.stopTitleFlash()
    this.removeFocusListener?.()
    this.removeFocusListener = undefined
    this.channel?.close()
    this.channel = undefined
  }

  // ── Raising ───────────────────────────────────────────────────────────────

  /**
   * Report why a finished turn raises nothing.
   * @param record - observed handoff.
   * @param config - current configuration.
   * @returns a short reason, or undefined when the reminder should be raised.
   */
  private rejection(record: TurnEndRecord, config: YourTurnConfig): string | undefined {
    if (!config.enabled) return 'plugin disabled'
    if (config.muteAll) return 'muted'
    if (!outcomeInScope(config.notifyOn, record.outcome)) return `outcome ${record.outcome} out of scope`
    if (record.subagent && !config.includeSubagents) return 'subagent session'
    if (record.durationMs < config.minTurnSeconds * 1000) return `turn shorter than ${String(config.minTurnSeconds)}s`
    if (this.local.mutedSessions.includes(record.sessionId)) return 'session muted'
    const snooze = this.local.snoozeUntil[record.sessionId]
    if (snooze !== undefined && snooze > Date.now()) return 'snoozed'
    if (config.onlyWhenUnfocused && pageAttended()) return 'window is attended'
    if (this.inQuietWindow(config)) return 'quiet hours'
    return undefined
  }

  /**
   * @param config - current configuration.
   * @returns whether the current local time falls inside the configured quiet window.
   */
  private inQuietWindow(config: YourTurnConfig): boolean {
    if (!config.quietHoursEnabled) return false
    const start = clockMinutes(config.quietHoursStart)
    const end = clockMinutes(config.quietHoursEnd)
    if (start === undefined || end === undefined) return false
    const now = new Date()
    return insideQuietWindow(now.getHours() * 60 + now.getMinutes(), start, end)
  }

  /** Enqueue a reminder and fire its effects. */
  private raise(reminder: Reminder): void {
    const config = this.config
    this.recentRaises.set(reminder.sessionId, reminder.raisedAt)
    this.post({ kind: 'raised', sessionId: reminder.sessionId, at: reminder.raisedAt })

    const current = this.state.getSnapshot()
    const queue = [...current.reminders, reminder].slice(-MAX_QUEUE)
    this.state.set({ ...current, reminders: queue })
    this.armHead(config)

    if (config.soundEnabled) {
      const preset = reminder.outcome === 'completed' || reminder.outcome === 'unknown'
        ? resolvePreset(config.soundPreset)
        : resolvePreset(config.errorSoundPreset)
      this.sound.play(preset, config.volume)
      this.publishAudioState(this.sound.isUnlocked())
    }
    if (config.systemNotification) this.postSystemNotification(reminder)
    if (config.flashTitle && !pageAttended()) this.startTitleFlash()
  }

  /**
   * Arm the auto-dismiss timer for whichever reminder is on screen.
   *
   * Only the head is timed. Timing the whole queue would let a reminder expire
   * while it was still waiting its turn to be shown, so the user would never see
   * it at all.
   */
  private armHead(config: YourTurnConfig): void {
    for (const id of [...this.timers.keys()]) this.clearTimer(id)
    const head = this.state.getSnapshot().reminders[0]
    if (head === undefined || config.autoDismissSeconds <= 0) return
    const timer = window.setTimeout(() => {
      this.timers.delete(head.id)
      this.dismiss(head.id)
    }, config.autoDismissSeconds * 1000)
    this.timers.set(head.id, timer)
  }

  /** Clear one timer. */
  private clearTimer(id: string): void {
    const timer = this.timers.get(id)
    if (timer === undefined) return
    window.clearTimeout(timer)
    this.timers.delete(id)
  }

  /** Re-arm the head's timer, and stop the title flash once nothing is pending. */
  private afterQueueChange(): void {
    this.armHead(this.config)
    if (this.state.getSnapshot().reminders.length === 0) this.stopTitleFlash()
  }

  /** Publish the audio-unlocked bit. */
  private publishAudioState(unlocked: boolean): void {
    const current = this.state.getSnapshot()
    if (current.audioUnlocked === unlocked) return
    this.state.set({ ...current, audioUnlocked: unlocked })
    this.onUnlockChange(unlocked)
  }

  // ── Browser effects ───────────────────────────────────────────────────────

  /** Send a best-effort system notification for one reminder. */
  private postSystemNotification(reminder: Reminder): void {
    const api = notificationApi()
    if (api === undefined || api.permission !== 'granted') return
    // Only worth a system banner when the page cannot show its own.
    if (!pageHidden()) return
    try {
      const notification = new api(reminder.title, {
        body: reminder.cwd ?? reminder.sessionId,
        tag: `dsh-your-turn:${reminder.sessionId}`,
        silent: true,
      })
      notification.onclick = () => {
        try {
          globalThis.focus()
        } catch {
          // Focus may be refused; the notification still closes.
        }
        this.dismiss(reminder.id)
        notification.close()
      }
    } catch (error) {
      console.warn('[dsh-your-turn] system notification failed', error)
    }
  }

  /** Alternate a marker in the document title until the page is attended again. */
  private startTitleFlash(): void {
    if (this.flashTimer !== undefined) return
    if (typeof document === 'undefined') return
    this.flashBase = document.title
    this.flashOn = false
    this.flashTimer = window.setInterval(() => {
      this.flashOn = !this.flashOn
      document.title = this.flashOn ? `● ${this.flashBase ?? ''}` : (this.flashBase ?? '')
    }, FLASH_INTERVAL_MS)
  }

  /** Restore the document title. */
  private stopTitleFlash(): void {
    if (this.flashTimer !== undefined) {
      window.clearInterval(this.flashTimer)
      this.flashTimer = undefined
    }
    if (this.flashBase !== undefined && typeof document !== 'undefined') {
      document.title = this.flashBase
    }
    this.flashBase = undefined
  }

  /** Stop flashing as soon as the page is attended again. */
  private watchFocus(): void {
    if (typeof window === 'undefined') return
    const handler = (): void => {
      if (!pageAttended()) return
      this.stopTitleFlash()
    }
    window.addEventListener('focus', handler)
    document?.addEventListener('visibilitychange', handler)
    this.removeFocusListener = () => {
      window.removeEventListener('focus', handler)
      document?.removeEventListener('visibilitychange', handler)
    }
  }

  // ── Cross-tab coordination ────────────────────────────────────────────────

  /** Open the same-origin coordination channel, when the browser has one. */
  private openChannel(): void {
    const ctor = (globalThis as unknown as { BroadcastChannel?: typeof BroadcastChannel }).BroadcastChannel
    if (ctor === undefined) return
    try {
      const channel = new ctor('dsh-your-turn')
      channel.onmessage = (event: MessageEvent): void => {
        const message = event.data as TabMessage | undefined
        if (message === undefined || typeof message !== 'object') return
        if (message.kind === 'raised') {
          this.recentRaises.set(message.sessionId, message.at)
          return
        }
        if (message.kind === 'dismissed') {
          for (const reminder of this.state.getSnapshot().reminders) {
            if (reminder.sessionId === message.sessionId) this.dismiss(reminder.id, false)
          }
        }
      }
      this.channel = channel
    } catch (error) {
      console.warn('[dsh-your-turn] cross-tab channel unavailable', error)
    }
  }

  /**
   * @param sessionId - session under consideration.
   * @returns whether another window raised a reminder for it just now.
   */
  private suppressedByAnotherTab(sessionId: string): boolean {
    const at = this.recentRaises.get(sessionId)
    if (at === undefined) return false
    return Date.now() - at < DEDUPE_MS
  }

  /** Announce one action to the other tabs. */
  private post(message: TabMessage): void {
    try {
      this.channel?.postMessage(message)
    } catch {
      // A closed channel is not worth reporting.
    }
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  /** Write the browser-local state, ignoring a refused write. */
  private persist(): void {
    saveLocalState(this.local)
  }

  /** @returns whether a session is currently running, for snooze re-checks. */
  private sessionRunning(sessionId: string): boolean {
    try {
      const sessions = this.ctx.get('sessions' as never) as SessionsFace | undefined
      const summary = sessions?.list.getSnapshot().byId[sessionId]
      return summary?.running === true
    } catch {
      return false
    }
  }}

/** @returns whether the page is visible and the window focused. */
export function pageAttended(): boolean {
  if (typeof document === 'undefined') return false
  if (document.visibilityState === 'hidden') return false
  if (typeof document.hasFocus === 'function') return document.hasFocus()
  return true
}

/** @returns whether the page is not visible. */
function pageHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden'
}

/** @returns the Notification constructor, when the browser exposes one. */
function notificationApi(): typeof Notification | undefined {
  const api = (globalThis as unknown as { Notification?: typeof Notification }).Notification
  return typeof api === 'function' ? api : undefined
}
