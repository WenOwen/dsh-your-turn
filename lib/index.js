import Schema from "@deepseek-ai/schemastery";
//#region src/shared/settings.ts
/** Package name; the ModuleLoader id and the Cordis patch `name`. */
const PACKAGE_NAME = "dsh-your-turn";
/**
* Where the reminder is drawn.
*
* The vocabulary is one-of, deliberately: a settings document written by an
* older build may still say `both`, and {@link normalizeConfig} folds that
* retired value back onto the default rather than drawing two reminders.
*/
const SURFACES = ["modal", "toast"];
/**
* Built-in chime voices, all synthesized at runtime (no shipped audio assets).
*
* Every member is audible: the vocabulary used to carry a silent `none` voice,
* but silence already has a home — the `soundEnabled` switch and the sidebar
* foot toggle. A settings document that still asks for `none` is an unknown
* value now, so it falls back to that field's default like any other stale
* vocabulary value.
*/
const SOUND_PRESETS = [
	"chime",
	"ping",
	"marimba",
	"arcade",
	"drop",
	"alert"
];
/** Compiled-in defaults; the Host schema and the browser fallback both read these. */
const CONFIG_DEFAULTS = Object.freeze({
	surface: "modal",
	autoDismissSeconds: 5,
	soundEnabled: true,
	soundPreset: "chime",
	errorSoundPreset: "alert",
	volume: 70,
	onlyWhenUnfocused: true,
	systemNotification: false,
	flashTitle: false
});
/** Hard bounds; the Host schema and the browser normalizer must agree on these. */
const LIMITS = Object.freeze({
	volume: {
		min: 0,
		max: 100
	},
	autoDismissSeconds: {
		min: 0,
		max: 600
	}
});
//#endregion
//#region src/index.ts
/** Cordis plugin name; matches the package name and the ModuleLoader id. */
const name = PACKAGE_NAME;
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
	surface: Schema.union([...SURFACES]).default(CONFIG_DEFAULTS.surface).description("Centred modal or top banner.").volatile(),
	autoDismissSeconds: Schema.number().step(1).min(LIMITS.autoDismissSeconds.min).max(LIMITS.autoDismissSeconds.max).default(CONFIG_DEFAULTS.autoDismissSeconds).description("Seconds before a reminder dismisses itself; 0 keeps it until closed.").volatile(),
	soundEnabled: Schema.boolean().default(CONFIG_DEFAULTS.soundEnabled).description("Play a chime when a reminder is raised.").volatile(),
	soundPreset: Schema.union([...SOUND_PRESETS]).default(CONFIG_DEFAULTS.soundPreset).description("Voice for a turn that finished cleanly.").volatile(),
	errorSoundPreset: Schema.union([...SOUND_PRESETS]).default(CONFIG_DEFAULTS.errorSoundPreset).description("Voice for a failed, aborted, or truncated turn.").volatile(),
	volume: Schema.number().step(1).min(LIMITS.volume.min).max(LIMITS.volume.max).default(CONFIG_DEFAULTS.volume).description("Chime volume, 0-100.").volatile(),
	onlyWhenUnfocused: Schema.boolean().default(CONFIG_DEFAULTS.onlyWhenUnfocused).description("Stay silent while the window is focused and the tab is visible.").volatile(),
	systemNotification: Schema.boolean().default(CONFIG_DEFAULTS.systemNotification).description("Mirror the reminder into a system notification when the page may use one.").volatile(),
	flashTitle: Schema.boolean().default(CONFIG_DEFAULTS.flashTitle).description("Flash the document title until the page regains focus.").volatile()
};
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
const Config = Schema.object(fields);
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
function apply(ctx) {
	ctx.inject(["settings"], (child) => {
		const settings = child.settings;
		if (settings === void 0 || typeof settings.configure !== "function") return;
		child.effect(() => settings.configure({ auto: false }, ctx.fiber));
	});
}
//#endregion
export { Config, apply, name };
