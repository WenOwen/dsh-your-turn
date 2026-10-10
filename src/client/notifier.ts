/**
 * The reminder queue: filtering, sound, cross-tab de-duplication, and the
 * browser-level effects that sit outside React.
 *
 * One instance per plugin instance. It owns:
 *
 * - the queue the popup and the banner both drain (head first);
 * - the decision of whether a finished turn is worth interrupting for;
 * - the chime, the system notification, and the title flash;
 * - pushed-back reminders in browser-local storage;
 * - telling the *other* tabs of the same origin what it just did, so three open
 *   windows raise one reminder instead of three.
 *
 * @module dsh-your-turn/client/notifier
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  type SoundPreset,
  type YourTurnConfig,
} from '../shared/settings.ts'
import { emptyLocalState, loadLocalState, saveLocalState, type LocalState } from './localState.ts'
import { Observable } from './observable.ts'
import type { ResolvedSettings, SettingsController } from './settings.ts'
import { resolvePreset, type SoundEngine } from './sound.ts'
import type { TurnEndRecord } from './turnWatcher.ts'
import type { QuestionRecord } from './questionWatcher.ts'

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
  /**
   * Whether the reminder is currently shown in the popup. Auto-dismiss flips
   * this to false, leaving the entry in the queue so the sidebar-foot tooltip
   * can still list it as "unread" until the user acknowledges it.
   */
  visibleInPopup: boolean
}

/** Everything the surfaces render. */
export interface NotifierState {
  /** Pending reminders; index 0 is the one on screen. */
  reminders: readonly Reminder[]
  /** Whether the browser has allowed audio yet. */
  audioUnlocked: boolean
}

/** How long a pushed-back reminder waits before it returns. */
export const SNOOZE_MS = 5 * 60 * 1000

/** Queue cap; beyond this the oldest pending reminder is dropped. */
const MAX_QUEUE = 20

/** Cross-tab de-duplication window. */
const DEDUPE_MS = 4000

/** One cross-tab announcement. */
type TabMessage =
  | { readonly kind: 'raised'; readonly sessionId: string; readonly at: number }
  | { readonly kind: 'dismissed'; readonly sessionId: string }
  | { readonly kind: 'question'; readonly key: string; readonly at: number }

/** The slice of `ctx.sessions` the notifier reads. */
interface SessionsFace {
  readonly list: {
    getSnapshot(): {
      readonly byId: Readonly<Record<string, {
        readonly running?: boolean
        /** The id of the panel currently displaying this Session, when set. */
        readonly retainedBy?: Readonly<Record<string, number>>
      } | undefined>>
    }
    subscribe(listener: () => void): () => void
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
  private readonly snoozeTimers = new Map<string, number>()
  private readonly dismissTimers = new Map<string, number>()
  private readonly recentRaises = new Map<string, number>()
  private readonly recentQuestions = new Map<string, number>()
  private channel: BroadcastChannel | undefined
  private removeFocusListener: (() => void) | undefined
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
      audioUnlocked: sound.isUnlocked(),
    })
    this.openChannel()
    this.watchMainSession()
  }

  /**
   * Subscribe to the Session list and acknowledge any pending reminder whose
   * Session is the one currently retained by the workspace's main view. The
   * user has effectively opened that session (sidebar click, search hit,
   * keyboard shortcut, the popup's "Jump" button) and the reminder is no
   * longer pending; without this, the only way to clear the speaker's
   * unread badge is to click the popup's "Got it" button, which the user
   * usually ignores once the popup auto-dismisses.
   */
  private watchMainSession(): void {
    let sessions: SessionsFace | undefined
    try {
      sessions = this.ctx.get('sessions' as never) as SessionsFace | undefined
    } catch {
      return
    }
    if (sessions === undefined) return
    const reconcile = (): void => {
      const byId = sessions!.list.getSnapshot().byId
      // The session currently displayed in the main panel: one row in the
      // Session list has a positive mainView retention token. Match the first
      // pending reminder for that session and acknowledge it silently.
      let opened: string | undefined
      for (const [id, summary] of Object.entries(byId)) {
        if ((summary?.retainedBy?.mainView ?? 0) > 0) { opened = id; break }
      }
      if (opened === undefined) return
      const target = this.state.getSnapshot().reminders.find(r => r.sessionId === opened)
      if (target === undefined) return
      this.acknowledge(target.id, false)
    }
    reconcile()
    const unsubscribe = sessions.list.subscribe(reconcile)
    this.ctx.effect(() => () => { unsubscribe() }, 'dsh-your-turn: main session watcher')
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
      visibleInPopup: true,
    })
  }

  /** Questions need attention even in the foreground; do not cover the answer card with another modal. */
  considerQuestion(record: QuestionRecord): void {
    const config = this.config
    if (this.disposed || !config.soundEnabled) return
    if (record.subagent) return
    const key = `${record.sessionId}:${record.key}`
    const previous = this.recentQuestions.get(key)
    if (previous !== undefined && Date.now() - previous < DEDUPE_MS) return
    const at = Date.now()
    this.recentQuestions.set(key, at)
    if (this.recentQuestions.size > 512) this.recentQuestions.delete(this.recentQuestions.keys().next().value!)
    this.post({ kind: 'question', key, at })
    this.sound.play(resolvePreset(config.soundPreset), config.volume)
    this.publishAudioState(this.sound.isUnlocked())
  }

  /**
   * Hide the reminder from the popup; the entry stays in the queue so the
   * sidebar-foot tooltip can still list it as "unread". Auto-dismiss uses this
   * path; manual "Got it" / "Snooze" / Esc use {@link acknowledge} to drop the
   * entry entirely.
   * @param id - reminder identity.
   */
  hideFromPopup(id: string): void {
    const current = this.state.getSnapshot()
    const next = current.reminders.map(reminder =>
      reminder.id === id ? { ...reminder, visibleInPopup: false } : reminder
    )
    if (next === current.reminders) return
    this.state.set({ ...current, reminders: next })
  }

  /**
   * Remove one reminder from the queue entirely. Use this when the user has
   * actually acknowledged it (clicked a session in the sidebar-foot tooltip,
   * pressed Esc, hit "Got it", or snoozed).
   * @param id - reminder identity.
   * @param announce - whether to tell other tabs (false when they told us).
   */
  acknowledge(id: string, announce = true): void {
    this.clearDismissTimer(id)
    const current = this.state.getSnapshot()
    const target = current.reminders.find((reminder) => reminder.id === id)
    if (target === undefined) return
    this.state.set({
      ...current,
      reminders: current.reminders.filter((reminder) => reminder.id !== id),
    })
    if (announce) this.post({ kind: 'dismissed', sessionId: target.sessionId })
  }

  /**
   * @deprecated Use {@link acknowledge}. Kept as an alias for callers that
   * already removed the popup and don't want to retitle the action.
   */
  dismiss(id: string, announce = true): void {
    this.acknowledge(id, announce)
  }

  /** Remove every pending reminder. */
  dismissAll(): void {
    for (const timer of this.dismissTimers.values()) window.clearTimeout(timer)
    this.dismissTimers.clear()
    const current = this.state.getSnapshot()
    if (current.reminders.length === 0) return
    this.state.set({ ...current, reminders: [] })
    for (const reminder of current.reminders) this.post({ kind: 'dismissed', sessionId: reminder.sessionId })
  }

  /** Cancel one reminder's self-dismissal, whatever scheduled it. */
  private clearDismissTimer(id: string): void {
    const timer = this.dismissTimers.get(id)
    if (timer === undefined) return
    window.clearTimeout(timer)
    this.dismissTimers.delete(id)
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
    for (const timer of this.snoozeTimers.values()) window.clearTimeout(timer)
    this.snoozeTimers.clear()
    for (const timer of this.dismissTimers.values()) window.clearTimeout(timer)
    this.dismissTimers.clear()
    this.removeFocusListener?.()
    this.removeFocusListener = undefined
    this.channel?.close()
    this.channel = undefined
    this.recentQuestions.clear()
  }

  // ── Raising ───────────────────────────────────────────────────────────────

  /**
   * Report why a finished turn raises nothing.
   * @param record - observed handoff.
   * @param config - current configuration.
   * @returns a short reason, or undefined when the reminder should be raised.
   */
  private rejection(record: TurnEndRecord, _config: YourTurnConfig): string | undefined {
    if (record.subagent) return 'subagent session'
    const snooze = this.local.snoozeUntil[record.sessionId]
    if (snooze !== undefined && snooze > Date.now()) return 'snoozed'
    return undefined
  }

  /** Enqueue a reminder and fire its effects. */
  private raise(reminder: Reminder): void {
    const config = this.config
    this.recentRaises.set(reminder.sessionId, reminder.raisedAt)
    this.post({ kind: 'raised', sessionId: reminder.sessionId, at: reminder.raisedAt })

    const current = this.state.getSnapshot()
    const queue = [...current.reminders, reminder].slice(-MAX_QUEUE)
    this.state.set({ ...current, reminders: queue })

    // Auto-dismissal hides the popup but keeps the entry in the queue so the
    // sidebar-foot tooltip can still list it as "unread" until the user
    // acknowledges it. The fire path re-reads the configuration: turning the
    // feature off while a reminder is up keeps that reminder visible.
    const autoDismissMs = config.autoDismissSeconds * 1000
    if (autoDismissMs > 0) {
      this.clearDismissTimer(reminder.id)
      this.dismissTimers.set(reminder.id, window.setTimeout(() => {
        this.dismissTimers.delete(reminder.id)
        if (this.disposed || this.config.autoDismissSeconds <= 0) return
        this.hideFromPopup(reminder.id)
      }, autoDismissMs))
    }

    if (config.soundEnabled) {
      const preset = reminder.outcome === 'completed' || reminder.outcome === 'unknown'
        ? resolvePreset(config.soundPreset)
        : resolvePreset(config.errorSoundPreset)
      this.sound.play(preset, config.volume)
      this.publishAudioState(this.sound.isUnlocked())
    }
  }

  /** Publish the audio-unlocked bit. */
  private publishAudioState(unlocked: boolean): void {
    const current = this.state.getSnapshot()
    if (current.audioUnlocked === unlocked) return
    this.state.set({ ...current, audioUnlocked: unlocked })
    this.onUnlockChange(unlocked)
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
        if (message.kind === 'question' && typeof message.key === 'string' && typeof message.at === 'number') {
          this.recentQuestions.set(message.key, message.at)
          if (this.recentQuestions.size > 512) this.recentQuestions.delete(this.recentQuestions.keys().next().value!)
          return
        }
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
