/**
 * dsh-your-turn — Host half.
 *
 * The reminder itself is a browser concern: the Session list the Web client
 * already holds carries every Agent's running state, so the popup, the chime
 * and the filters are decided in the page that can actually draw and play them.
 *
 * What the Host owns is the configuration. Declaring it here, with every
 * user-editable field marked `.volatile()`, gives the plugin one canonical,
 * revision-fenced, profile-persisted settings section that the browser half
 * reads and writes through `ctx.configForms` — no bespoke storage, no second
 * copy of the truth, and the same values for every browser pointed at this
 * deployment.
 *
 * @module dsh-your-turn
 */

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import {
  CONFIG_DEFAULTS,
  LIMITS,
  NOTIFY_ON,
  PACKAGE_NAME,
  SOUND_PRESETS,
  SURFACES,
  type YourTurnConfig,
} from './shared/settings.ts'

/** Cordis plugin name; matches the package name and the ModuleLoader id. */
export const name = PACKAGE_NAME

/**
 * The plugin's configuration.
 *
 * Field names are settings paths: `${ENTRY_ID}.${field}` in the profile's
 * settings document. Every field is optional, so a partial section is valid.
 */
export interface Config extends YourTurnConfig {}

/**
 * Field schemas, keyed by the interface above.
 *
 * The `satisfies` clause is the contract that keeps the two definitions in step:
 * a field added to {@link Config} without a schema entry is a compile error, and
 * so is a schema entry the interface does not declare.
 *
 * Every user-editable field is marked `.volatile()`. That is what makes it
 * appear in the settings document at all — `dsh-settings` projects exactly the
 * volatile fields of each active Loader entry — and what makes each one
 * independently writable without remounting the plugin.
 */
const fields = {
  enabled: Schema.boolean()
    .default(CONFIG_DEFAULTS.enabled)
    .description('Master switch. When off the reminder is never raised.')
    .volatile(),
  surface: Schema.union([...SURFACES])
    .default(CONFIG_DEFAULTS.surface)
    .description('Centred modal, top banner, or both.')
    .volatile(),
  autoDismissSeconds: Schema.number()
    .step(1)
    .min(LIMITS.autoDismissSeconds.min)
    .max(LIMITS.autoDismissSeconds.max)
    .default(CONFIG_DEFAULTS.autoDismissSeconds)
    .description('Dismiss the reminder after this many seconds. 0 keeps it until dismissed.')
    .volatile(),
  soundEnabled: Schema.boolean()
    .default(CONFIG_DEFAULTS.soundEnabled)
    .description('Play a chime when a reminder is raised.')
    .volatile(),
  soundPreset: Schema.union([...SOUND_PRESETS])
    .default(CONFIG_DEFAULTS.soundPreset)
    .description('Voice for a turn that finished cleanly.')
    .volatile(),
  errorSoundPreset: Schema.union([...SOUND_PRESETS])
    .default(CONFIG_DEFAULTS.errorSoundPreset)
    .description('Voice for a failed, aborted, or truncated turn.')
    .volatile(),
  volume: Schema.number()
    .step(1)
    .min(LIMITS.volume.min)
    .max(LIMITS.volume.max)
    .default(CONFIG_DEFAULTS.volume)
    .description('Chime volume, 0-100.')
    .volatile(),
  onlyWhenUnfocused: Schema.boolean()
    .default(CONFIG_DEFAULTS.onlyWhenUnfocused)
    .description('Stay silent while the window is focused and the tab is visible.')
    .volatile(),
  minTurnSeconds: Schema.number()
    .step(1)
    .min(LIMITS.minTurnSeconds.min)
    .max(LIMITS.minTurnSeconds.max)
    .default(CONFIG_DEFAULTS.minTurnSeconds)
    .description('Ignore turns shorter than this many seconds. 0 disables the filter.')
    .volatile(),
  includeSubagents: Schema.boolean()
    .default(CONFIG_DEFAULTS.includeSubagents)
    .description('Also remind for subagent sessions. Off by default — they cascade.')
    .volatile(),
  notifyOn: Schema.union([...NOTIFY_ON])
    .default(CONFIG_DEFAULTS.notifyOn)
    .description('Which turn outcomes raise a reminder.')
    .volatile(),
  systemNotification: Schema.boolean()
    .default(CONFIG_DEFAULTS.systemNotification)
    .description('Mirror the reminder into a system notification when the page may use one.')
    .volatile(),
  flashTitle: Schema.boolean()
    .default(CONFIG_DEFAULTS.flashTitle)
    .description('Flash the document title until the page regains focus.')
    .volatile(),
  quietHoursEnabled: Schema.boolean()
    .default(CONFIG_DEFAULTS.quietHoursEnabled)
    .description('Suppress reminders inside the quiet window.')
    .volatile(),
  quietHoursStart: Schema.string()
    .default(CONFIG_DEFAULTS.quietHoursStart)
    .description('Quiet window start, HH:MM local time.')
    .volatile(),
  quietHoursEnd: Schema.string()
    .default(CONFIG_DEFAULTS.quietHoursEnd)
    .description('Quiet window end, HH:MM local time. A window may wrap past midnight.')
    .volatile(),
  muteAll: Schema.boolean()
    .default(CONFIG_DEFAULTS.muteAll)
    .description('Suppress every reminder and sound without changing the other settings.')
    .volatile(),
} satisfies Record<keyof Config, unknown>

/**
 * Runtime schema for {@link Config}.
 *
 * Defaults and hard bounds live here so an invalid profile patch fails loudly at
 * load time, and so the settings document's own defaults match the browser
 * half's compiled-in fallbacks (both come from `shared/settings.ts`).
 *
 * Deliberately exported without an explicit `Schema<Config>` annotation: the
 * fields are volatile, so the schema's own output type is the reference form
 * (`Volatile<T>` per field) that Cordis reads with `.get()`, not the plain shape
 * the interface describes. The `satisfies` clause above is what ties the two
 * together.
 */
export const Config = Schema.object(fields)

/**
 * Host plugin body.
 *
 * The plugin ships its own settings page, so it tells the settings service not
 * to advertise an auto-generated one. The registration is optional and
 * effect-scoped: a composition without `dsh-settings` still loads this plugin,
 * and a Settings service that arrives later still picks the policy up.
 *
 * @param ctx - Host Cordis context.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (child) => {
    const settings = (child as unknown as { settings: SettingsPolicyFace }).settings
    if (settings === undefined || typeof settings.configure !== 'function') return
    child.effect(() => settings.configure({ auto: false }, ctx.fiber))
  })
}

/** The slice of `ctx.settings` this plugin uses. */
interface SettingsPolicyFace {
  configure(
    presentation: { auto?: boolean },
    owner?: unknown,
  ): () => void
}
