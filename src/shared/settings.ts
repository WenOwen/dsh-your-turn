/**
 * The one definition of this plugin's configuration, shared by both halves.
 *
 * The Host half projects it into a Schemastery schema (it is the settings
 * document's owner); the browser half compiles the same defaults in so it can
 * run on them before the settings document has been read — or when the page is
 * not allowed to read it at all.
 *
 * This module must stay dependency-free: the browser bundle inlines it too.
 */

/** Loader entry id from `cordis.patch.yml`; also the settings namespace. */
export const ENTRY_ID = 'your-turn'

/** Package name; the ModuleLoader id and the Cordis patch `name`. */
export const PACKAGE_NAME = 'dsh-your-turn'

/** Locale namespace registered through `ctx.locale.register`. */
export const LOCALE_NS = 'yourTurn'

/** Where the reminder is drawn. */
export const SURFACES = ['modal', 'toast', 'both'] as const
export type Surface = (typeof SURFACES)[number]

/** Which turn-end outcomes raise a reminder. */
export const NOTIFY_ON = ['success', 'success-and-failure', 'all'] as const
export type NotifyOn = (typeof NOTIFY_ON)[number]

/**
 * Failure classification of one finished turn. Derived on the browser side
 * from the session event window when the Session is retained there, and
 * otherwise inferred from the Agent running-state edge.
 */
export const TURN_OUTCOMES = ['completed', 'failed', 'aborted', 'limited', 'unknown'] as const
export type TurnOutcome = (typeof TURN_OUTCOMES)[number]

/** Built-in chime voices, all synthesized at runtime (no shipped audio assets). */
export const SOUND_PRESETS = ['chime', 'ping', 'marimba', 'arcade', 'drop', 'alert', 'none'] as const
export type SoundPreset = (typeof SOUND_PRESETS)[number]

/** Voices that actually produce sound. */
export type PlayableSoundPreset = Exclude<SoundPreset, 'none'>

/** Fallback voice used when a configured voice is unknown to this build. */
export const FALLBACK_SOUND_PRESET: SoundPreset = 'chime'

/** The user-editable configuration surface. Field names are settings paths. */
export interface YourTurnConfig {
  /** Master switch. When false the watcher keeps no state and nothing is shown. */
  enabled: boolean
  /** Reminder surface: the centred modal, the top banner, or both. */
  surface: Surface
  /** Auto-dismiss delay in seconds; 0 keeps the reminder until it is dismissed. */
  autoDismissSeconds: number
  /** Play a chime when a reminder is raised. */
  soundEnabled: boolean
  /** Voice used for successful turn ends. */
  soundPreset: SoundPreset
  /** Voice used for failed, aborted, or truncated turn ends. */
  errorSoundPreset: SoundPreset
  /** Playback volume, 0-100. */
  volume: number
  /** Only remind while the window is unfocused or the tab is hidden. */
  onlyWhenUnfocused: boolean
  /** Skip reminders for turns shorter than this many seconds; 0 disables the filter. */
  minTurnSeconds: number
  /** Also remind for subagent sessions (off by default: they cascade). */
  includeSubagents: boolean
  /** Which outcomes raise a reminder. */
  notifyOn: NotifyOn
  /** Mirror the reminder into a system notification when the page may use one. */
  systemNotification: boolean
  /** Flash the document title until the page regains focus. */
  flashTitle: boolean
  /** Suppress reminders inside the quiet window. */
  quietHoursEnabled: boolean
  /** Quiet window start, `HH:MM` in local time. */
  quietHoursStart: string
  /** Quiet window end, `HH:MM` in local time; a window may wrap past midnight. */
  quietHoursEnd: string
  /** Suppress every reminder and every sound without changing the other settings. */
  muteAll: boolean
}

/** Compiled-in defaults; the Host schema and the browser fallback both read these. */
export const CONFIG_DEFAULTS: Readonly<YourTurnConfig> = Object.freeze({
  enabled: true,
  surface: 'modal',
  autoDismissSeconds: 45,
  soundEnabled: true,
  soundPreset: 'chime',
  errorSoundPreset: 'alert',
  volume: 70,
  onlyWhenUnfocused: true,
  minTurnSeconds: 3,
  includeSubagents: false,
  notifyOn: 'success-and-failure',
  systemNotification: false,
  flashTitle: false,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  muteAll: false,
})

/** Clamp helper shared by the schema bounds and the browser-side normalizer. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Hard bounds; the Host schema and the browser normalizer must agree on these. */
export const LIMITS = Object.freeze({
  autoDismissSeconds: { min: 0, max: 3600 },
  volume: { min: 0, max: 100 },
  minTurnSeconds: { min: 0, max: 3600 },
})

function oneOf<T extends string>(options: readonly T[], fallback: T, value: unknown): T {
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/** Accept `HH:MM` (or `H:MM`); anything else falls back. */
export function normalizeClock(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
    if (match !== null) {
      const hours = Number(match[1])
      const minutes = Number(match[2])
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
      }
    }
  }
  return fallback
}

/**
 * Coerce a partial, possibly stale or hostile section into a complete config.
 *
 * The settings document is user-editable YAML and may predate this build, so
 * every field is validated here rather than trusted. `undefined` fields fall
 * back to {@link CONFIG_DEFAULTS}.
 *
 * @param input - raw section from the settings document or a JSON payload.
 * @returns a complete, in-range configuration.
 */
export function normalizeConfig(input: unknown): YourTurnConfig {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  return {
    enabled: bool(raw.enabled, CONFIG_DEFAULTS.enabled),
    surface: oneOf(SURFACES, CONFIG_DEFAULTS.surface, raw.surface),
    autoDismissSeconds: clamp(
      typeof raw.autoDismissSeconds === 'number' ? raw.autoDismissSeconds : CONFIG_DEFAULTS.autoDismissSeconds,
      LIMITS.autoDismissSeconds.min,
      LIMITS.autoDismissSeconds.max,
    ),
    soundEnabled: bool(raw.soundEnabled, CONFIG_DEFAULTS.soundEnabled),
    soundPreset: oneOf(SOUND_PRESETS, CONFIG_DEFAULTS.soundPreset, raw.soundPreset),
    errorSoundPreset: oneOf(SOUND_PRESETS, CONFIG_DEFAULTS.errorSoundPreset, raw.errorSoundPreset),
    volume: clamp(
      typeof raw.volume === 'number' ? raw.volume : CONFIG_DEFAULTS.volume,
      LIMITS.volume.min,
      LIMITS.volume.max,
    ),
    onlyWhenUnfocused: bool(raw.onlyWhenUnfocused, CONFIG_DEFAULTS.onlyWhenUnfocused),
    minTurnSeconds: clamp(
      typeof raw.minTurnSeconds === 'number' ? raw.minTurnSeconds : CONFIG_DEFAULTS.minTurnSeconds,
      LIMITS.minTurnSeconds.min,
      LIMITS.minTurnSeconds.max,
    ),
    includeSubagents: bool(raw.includeSubagents, CONFIG_DEFAULTS.includeSubagents),
    notifyOn: oneOf(NOTIFY_ON, CONFIG_DEFAULTS.notifyOn, raw.notifyOn),
    systemNotification: bool(raw.systemNotification, CONFIG_DEFAULTS.systemNotification),
    flashTitle: bool(raw.flashTitle, CONFIG_DEFAULTS.flashTitle),
    quietHoursEnabled: bool(raw.quietHoursEnabled, CONFIG_DEFAULTS.quietHoursEnabled),
    quietHoursStart: normalizeClock(raw.quietHoursStart, CONFIG_DEFAULTS.quietHoursStart),
    quietHoursEnd: normalizeClock(raw.quietHoursEnd, CONFIG_DEFAULTS.quietHoursEnd),
    muteAll: bool(raw.muteAll, CONFIG_DEFAULTS.muteAll),
  }
}

/** `HH:MM` parsed to minutes past local midnight, or undefined when malformed. */
export function clockMinutes(value: string): number | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (match === null) return undefined
  return Number(match[1]) * 60 + Number(match[2])
}

/**
 * Whether a local wall-clock time falls inside a possibly-wrapping quiet window.
 *
 * @param now - minutes past local midnight of the instant under test.
 * @param start - window start in minutes past midnight.
 * @param end - window end in minutes past midnight.
 * @returns true when `now` is inside the window (a start equal to the end is a full day).
 */
export function insideQuietWindow(now: number, start: number, end: number): boolean {
  if (start === end) return true
  if (start < end) return now >= start && now < end
  return now >= start || now < end
}

/**
 * Whether an outcome should raise a reminder under the configured scope.
 *
 * @param notifyOn - configured scope.
 * @param outcome - classified outcome of the finished turn.
 * @returns true when the reminder is in scope.
 */
export function outcomeInScope(notifyOn: NotifyOn, outcome: TurnOutcome): boolean {
  if (notifyOn === 'all') return true
  // `unknown` is the inference used when the Agent returns to idle without a
  // readable turn/end record; it means "nothing went visibly wrong", so it
  // follows the success branch rather than the failure one.
  if (outcome === 'completed' || outcome === 'unknown') return true
  return notifyOn === 'success-and-failure' && outcome === 'failed'
}
