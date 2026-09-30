import Schema from "@deepseek-ai/schemastery";
import { Context } from "@deepseek-ai/cordis";
//#region src/shared/settings.d.ts
/** Where the reminder is drawn. */
declare const SURFACES: readonly ["modal", "toast", "both"];
type Surface = (typeof SURFACES)[number];
/** Which turn-end outcomes raise a reminder. */
declare const NOTIFY_ON: readonly ["success", "success-and-failure", "all"];
type NotifyOn = (typeof NOTIFY_ON)[number];
/** Built-in chime voices, all synthesized at runtime (no shipped audio assets). */
declare const SOUND_PRESETS: readonly ["chime", "ping", "marimba", "arcade", "drop", "alert", "none"];
type SoundPreset = (typeof SOUND_PRESETS)[number];
/** The user-editable configuration surface. Field names are settings paths. */
interface YourTurnConfig {
  /** Master switch. When false the watcher keeps no state and nothing is shown. */
  enabled: boolean;
  /** Reminder surface: the centred modal, the top banner, or both. */
  surface: Surface;
  /** Auto-dismiss delay in seconds; 0 keeps the reminder until it is dismissed. */
  autoDismissSeconds: number;
  /** Play a chime when a reminder is raised. */
  soundEnabled: boolean;
  /** Voice used for successful turn ends. */
  soundPreset: SoundPreset;
  /** Voice used for failed, aborted, or truncated turn ends. */
  errorSoundPreset: SoundPreset;
  /** Playback volume, 0-100. */
  volume: number;
  /** Only remind while the window is unfocused or the tab is hidden. */
  onlyWhenUnfocused: boolean;
  /** Skip reminders for turns shorter than this many seconds; 0 disables the filter. */
  minTurnSeconds: number;
  /** Also remind for subagent sessions (off by default: they cascade). */
  includeSubagents: boolean;
  /** Which outcomes raise a reminder. */
  notifyOn: NotifyOn;
  /** Mirror the reminder into a system notification when the page may use one. */
  systemNotification: boolean;
  /** Flash the document title until the page regains focus. */
  flashTitle: boolean;
  /** Suppress reminders inside the quiet window. */
  quietHoursEnabled: boolean;
  /** Quiet window start, `HH:MM` in local time. */
  quietHoursStart: string;
  /** Quiet window end, `HH:MM` in local time; a window may wrap past midnight. */
  quietHoursEnd: string;
  /** Suppress every reminder and every sound without changing the other settings. */
  muteAll: boolean;
}
//#endregion
//#region src/index.d.ts
/** Cordis plugin name; matches the package name and the ModuleLoader id. */
declare const name = "dsh-your-turn";
/**
 * The plugin's configuration.
 *
 * Field names are settings paths: `${ENTRY_ID}.${field}` in the profile's
 * settings document. Every field is optional, so a partial section is valid.
 */
interface Config extends YourTurnConfig {}
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
declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
  enabled: Schema<boolean, boolean, "volatile-defined">;
  surface: Schema<"modal" | "toast" | "both", "modal" | "toast" | "both", "volatile-defined">;
  autoDismissSeconds: Schema<number, number, "volatile-defined">;
  soundEnabled: Schema<boolean, boolean, "volatile-defined">;
  soundPreset: Schema<"chime" | "ping" | "marimba" | "arcade" | "drop" | "alert" | "none", "chime" | "ping" | "marimba" | "arcade" | "drop" | "alert" | "none", "volatile-defined">;
  errorSoundPreset: Schema<"chime" | "ping" | "marimba" | "arcade" | "drop" | "alert" | "none", "chime" | "ping" | "marimba" | "arcade" | "drop" | "alert" | "none", "volatile-defined">;
  volume: Schema<number, number, "volatile-defined">;
  onlyWhenUnfocused: Schema<boolean, boolean, "volatile-defined">;
  minTurnSeconds: Schema<number, number, "volatile-defined">;
  includeSubagents: Schema<boolean, boolean, "volatile-defined">;
  notifyOn: Schema<"success" | "success-and-failure" | "all", "success" | "success-and-failure" | "all", "volatile-defined">;
  systemNotification: Schema<boolean, boolean, "volatile-defined">;
  flashTitle: Schema<boolean, boolean, "volatile-defined">;
  quietHoursEnabled: Schema<boolean, boolean, "volatile-defined">;
  quietHoursStart: Schema<string, string, "volatile-defined">;
  quietHoursEnd: Schema<string, string, "volatile-defined">;
  muteAll: Schema<boolean, boolean, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
  enabled: Schema<boolean, boolean, "volatile-defined">;
  surface: Schema<"modal" | "toast" | "both", "modal" | "toast" | "both", "volatile-defined">;
  autoDismissSeconds: Schema<number, number, "volatile-defined">;
  soundEnabled: Schema<boolean, boolean, "volatile-defined">;
  soundPreset: Schema<"chime" | "ping" | "marimba" | "arcade" | "drop" | "alert" | "none", "chime" | "ping" | "marimba" | "arcade" | "drop" | "alert" | "none", "volatile-defined">;
  errorSoundPreset: Schema<"chime" | "ping" | "marimba" | "arcade" | "drop" | "alert" | "none", "chime" | "ping" | "marimba" | "arcade" | "drop" | "alert" | "none", "volatile-defined">;
  volume: Schema<number, number, "volatile-defined">;
  onlyWhenUnfocused: Schema<boolean, boolean, "volatile-defined">;
  minTurnSeconds: Schema<number, number, "volatile-defined">;
  includeSubagents: Schema<boolean, boolean, "volatile-defined">;
  notifyOn: Schema<"success" | "success-and-failure" | "all", "success" | "success-and-failure" | "all", "volatile-defined">;
  systemNotification: Schema<boolean, boolean, "volatile-defined">;
  flashTitle: Schema<boolean, boolean, "volatile-defined">;
  quietHoursEnabled: Schema<boolean, boolean, "volatile-defined">;
  quietHoursStart: Schema<string, string, "volatile-defined">;
  quietHoursEnd: Schema<string, string, "volatile-defined">;
  muteAll: Schema<boolean, boolean, "volatile-defined">;
}>>, "plain">;
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
declare function apply(ctx: Context): void;
//#endregion
export { Config, apply, name };