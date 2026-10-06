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

/**
 * Where the reminder is drawn.
 *
 * The vocabulary is one-of, deliberately: a settings document written by an
 * older build may still say `both`, and {@link normalizeConfig} folds that
 * retired value back onto the default rather than drawing two reminders.
 */
export const SURFACES = ['modal', 'toast'] as const
export type Surface = (typeof SURFACES)[number]

/** Legacy helper vocabulary; the plugin itself now reminds for every outcome. */
export const NOTIFY_ON = ['success', 'success-and-failure', 'all'] as const
export type NotifyOn = (typeof NOTIFY_ON)[number]

/**
 * Failure classification of one finished turn. Derived on the browser side
 * from the session event window when the Session is retained there, and
 * otherwise inferred from the Agent running-state edge.
 */
export const TURN_OUTCOMES = ['completed', 'failed', 'aborted', 'limited', 'unknown'] as const
export type TurnOutcome = (typeof TURN_OUTCOMES)[number]

/**
 * Built-in chime voices, all synthesized at runtime (no shipped audio assets).
 *
 * Every member is audible: the vocabulary used to carry a silent `none` voice,
 * but silence already has a home — the `soundEnabled` switch and the sidebar
 * foot toggle. A settings document that still asks for `none` is an unknown
 * value now, so it falls back to that field's default like any other stale
 * vocabulary value.
 */
export const SOUND_PRESETS = ['chime', 'ping', 'marimba', 'arcade', 'drop', 'alert'] as const
export type SoundPreset = (typeof SOUND_PRESETS)[number]

/** Fallback voice used when a configured voice is unknown to this build. */
export const FALLBACK_SOUND_PRESET: SoundPreset = 'chime'

/** The user-editable configuration surface. Field names are settings paths. */
export interface YourTurnConfig {
  /** Reminder surface: the centred modal or the top banner. */
  surface: Surface
  /** Seconds before a reminder dismisses itself; 0 keeps it until you close it. */
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
  /** Mirror the reminder into a system notification when the page may use one. */
  systemNotification: boolean
  /** Flash the document title until the page regains focus. */
  flashTitle: boolean
}

/** Compiled-in defaults; the Host schema and the browser fallback both read these. */
export const CONFIG_DEFAULTS: Readonly<YourTurnConfig> = Object.freeze({
  surface: 'modal',
  autoDismissSeconds: 5,
  soundEnabled: true,
  soundPreset: 'chime',
  errorSoundPreset: 'alert',
  volume: 70,
  onlyWhenUnfocused: true,
  systemNotification: false,
  flashTitle: false,
})

/** Clamp helper shared by the schema bounds and the browser-side normalizer. */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** Hard bounds; the Host schema and the browser normalizer must agree on these. */
export const LIMITS = Object.freeze({
  volume: { min: 0, max: 100 },
  autoDismissSeconds: { min: 0, max: 600 },
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
 * back to {@link CONFIG_DEFAULTS}, and a retired vocabulary value (for example
 * the removed `surface: both`) falls back the same way.
 *
 * @param input - raw section from the settings document or a JSON payload.
 * @returns a complete, in-range configuration.
 */
export function normalizeConfig(input: unknown): YourTurnConfig {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>
  return {
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
    systemNotification: bool(raw.systemNotification, CONFIG_DEFAULTS.systemNotification),
    flashTitle: bool(raw.flashTitle, CONFIG_DEFAULTS.flashTitle),
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
