import Schema from "@deepseek-ai/schemastery";
import { Context } from "@deepseek-ai/cordis";
//#region src/shared/settings.d.ts
/**
 * Where the reminder is drawn.
 *
 * The vocabulary is one-of, deliberately: a settings document written by an
 * older build may still say `both`, and {@link normalizeConfig} folds that
 * retired value back onto the default rather than drawing two reminders.
 */
declare const SURFACES: readonly ["modal", "toast"];
type Surface = (typeof SURFACES)[number];
/** Built-in chime voices, all synthesized at runtime (no shipped audio assets). */
declare const SOUND_PRESETS: readonly ["chime", "ping", "marimba", "arcade", "drop", "alert", "none"];
type SoundPreset = (typeof SOUND_PRESETS)[number];
/** The user-editable configuration surface. Field names are settings paths. */
interface YourTurnConfig {
  /** Reminder surface: the centred modal or the top banner. */
  surface: Surface;
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
  /** Mirror the reminder into a system notification when the page may use one. */
  systemNotification: boolean;
  /** Flash the document title until the page regains focus. */
  flashTitle: boolean;
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
  surface: Schema<"modal" | "toast", "modal" | "toast", "volatile-defined">;
  soundEnabled: Schema<boolean, boolean, "volatile-defined">;
  soundPreset: Schema<"chime" | "ping" | "marimba" | "arcade" | "drop" | "alert" | "none", "chime" | "ping" | "marimba" | "arcade" | "drop" | "alert" | "none", "volatile-defined">;
  errorSoundPreset: Schema<"chime" | "ping" | "marimba" | "arcade" | "drop" | "alert" | "none", "chime" | "ping" | "marimba" | "arcade" | "drop" | "alert" | "none", "volatile-defined">;
  volume: Schema<number, number, "volatile-defined">;
  onlyWhenUnfocused: Schema<boolean, boolean, "volatile-defined">;
  systemNotification: Schema<boolean, boolean, "volatile-defined">;
  flashTitle: Schema<boolean, boolean, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
  surface: Schema<"modal" | "toast", "modal" | "toast", "volatile-defined">;
  soundEnabled: Schema<boolean, boolean, "volatile-defined">;
  soundPreset: Schema<"chime" | "ping" | "marimba" | "arcade" | "drop" | "alert" | "none", "chime" | "ping" | "marimba" | "arcade" | "drop" | "alert" | "none", "volatile-defined">;
  errorSoundPreset: Schema<"chime" | "ping" | "marimba" | "arcade" | "drop" | "alert" | "none", "chime" | "ping" | "marimba" | "arcade" | "drop" | "alert" | "none", "volatile-defined">;
  volume: Schema<number, number, "volatile-defined">;
  onlyWhenUnfocused: Schema<boolean, boolean, "volatile-defined">;
  systemNotification: Schema<boolean, boolean, "volatile-defined">;
  flashTitle: Schema<boolean, boolean, "volatile-defined">;
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