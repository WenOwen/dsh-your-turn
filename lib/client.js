window.__ModuleLoader__.load({
	id: "@wu5/dsh-your-turn",
	factory: (require) => {
		try {
			var module = { exports: {} };
			var exports = module.exports;
			Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
			let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
			let react = require("react");
			let react_jsx_runtime = require("react/jsx-runtime");
			//#region src/client/observable.ts
			/**
			* A minimal snapshot source, plus the React binding for it.
			*
			* The plugin holds three pieces of browser state — the resolved configuration,
			* the reminder queue, and the title-flash flag — and every one of them is a
			* root-scoped singleton owned by this plugin instance. A hand-rolled source
			* keeps that state in one plain object with no per-scope instance machinery,
			* no store seat on the Slot registration, and nothing to dispose: the React
			* binding reads it through `useSyncExternalStore`, which is the same contract
			* the framework's snapshot stores expose.
			*
			* @module dsh-your-turn/client/observable
			*/
			/** A writable {@link SnapshotSource}. */
			var Observable = class {
				value;
				listeners = /* @__PURE__ */ new Set();
				/** @param initial - starting value. */
				constructor(initial) {
					this.value = initial;
				}
				/** @returns the current value. */
				getSnapshot = () => this.value;
				/**
				* Observe value replacement.
				* @param listener - change callback.
				* @returns the unsubscribe function.
				*/
				subscribe = (listener) => {
					this.listeners.add(listener);
					return () => {
						this.listeners.delete(listener);
					};
				};
				/**
				* Replace the value and notify when it actually changed.
				* @param next - next value.
				*/
				set(next) {
					if (Object.is(this.value, next)) return;
					this.value = next;
					this.publish();
				}
				/**
				* Replace the value from its predecessor; the updater must return the same
				* reference when nothing changed, so callers can build on immutability.
				* @param updater - next-value function.
				*/
				update(updater) {
					this.set(updater(this.value));
				}
				/** Notify every subscriber, tolerating one throwing listener. */
				publish() {
					for (const listener of [...this.listeners]) try {
						listener();
					} catch (error) {
						console.error("[dsh-your-turn] snapshot listener failed", error);
					}
				}
			};
			/**
			* Subscribe a component to a snapshot source.
			* @param source - the source to read.
			* @returns the current value, re-rendering on change.
			*/
			function useSnapshot(source) {
				const subscribe = (0, react.useCallback)((listener) => source.subscribe(listener), [source]);
				const getSnapshot = (0, react.useCallback)(() => source.getSnapshot(), [source]);
				return (0, react.useSyncExternalStore)(subscribe, getSnapshot, getSnapshot);
			}
			//#endregion
			//#region src/client/immediateSettings.ts
			/** Field-local automatic writes, serialized so fast clicks cannot be lost by an in-flight save. */
			var ImmediateSettings = class {
				scope;
				specs;
				view;
				actions = {
					edit: (field, text) => this.edit(field, text),
					resetField: (field) => this.reset([field]),
					resetAll: () => this.reset(this.specs.map((spec) => spec.field))
				};
				model;
				drafts = /* @__PURE__ */ new Map();
				pending = /* @__PURE__ */ new Map();
				failed = /* @__PURE__ */ new Set();
				unsubscribe;
				version = 0;
				savedVersion = 0;
				writing = false;
				disposed = false;
				constructor(scope, specs) {
					this.scope = scope;
					this.specs = specs;
					this.model = new _deepseek_ai_dsh_client_ui_primitives.SettingsFormModel(scope, [...specs]);
					const bound = this.model.bind(() => this.project());
					this.view = new Observable(bound.getSnapshot());
					this.unsubscribe = bound.subscribe(() => this.publish());
				}
				project() {
					return {
						shell: {
							...this.model.shell(),
							saving: this.writing,
							failed: this.failed.size > 0
						},
						savedVersion: this.savedVersion,
						fields: Object.fromEntries(this.specs.map((spec) => [spec.field, this.model.field(spec.field)]))
					};
				}
				publish() {
					if (!this.disposed) this.view.set(this.project());
				}
				edit(field, text) {
					if (this.disposed || !this.scope.getSnapshot().writable) return;
					const spec = this.specs.find((spec) => spec.field === field);
					if (spec === void 0) return;
					const edit = {
						field,
						text,
						version: ++this.version
					};
					this.drafts.set(field, edit);
					this.failed.delete(field);
					this.model.actions().edit(field, text);
					const parsed = spec.parse(text);
					this.pending.delete(field);
					if (parsed !== void 0) {
						const op = parsed.kind === "clear" ? {
							op: "unset",
							path: [field]
						} : {
							op: "set",
							path: [field],
							value: parsed.value
						};
						this.pending.set(field, {
							edits: [edit],
							ops: [op]
						});
					}
					this.publish();
					this.flush();
				}
				reset(fields) {
					if (this.disposed || !this.scope.getSnapshot().writable) return;
					const edits = fields.map((field) => ({
						field,
						version: ++this.version
					}));
					for (const edit of edits) {
						this.drafts.set(edit.field, edit);
						this.pending.delete(edit.field);
						this.failed.delete(edit.field);
						this.model.actions().resetField(edit.field);
					}
					this.pending.set(fields.length === 1 ? fields[0] : "@resetAll", {
						edits,
						ops: fields.map((field) => ({
							op: "unset",
							path: [field]
						}))
					});
					this.publish();
					this.flush();
				}
				rebase() {
					this.model.actions().discard();
					for (const edit of this.drafts.values()) if (edit.text === void 0) this.model.actions().resetField(edit.field);
					else this.model.actions().edit(edit.field, edit.text);
				}
				async flush() {
					if (this.writing || this.disposed || this.pending.size === 0) return;
					this.writing = true;
					this.publish();
					try {
						while (!this.disposed && this.pending.size > 0) {
							const [key, write] = this.pending.entries().next().value;
							this.pending.delete(key);
							let accepted = false;
							try {
								const snapshot = this.scope.getSnapshot();
								if (snapshot.writable) accepted = await this.scope.mutate(write.ops, snapshot.revision);
							} catch (error) {
								console.warn("[dsh-your-turn] automatic settings write failed", error);
							}
							if (this.disposed) break;
							if (accepted) this.savedVersion++;
							for (const edit of write.edits) {
								if (this.drafts.get(edit.field)?.version !== edit.version) continue;
								if (accepted) {
									this.drafts.delete(edit.field);
									this.failed.delete(edit.field);
								} else this.failed.add(edit.field);
							}
							this.rebase();
							this.publish();
						}
					} finally {
						this.writing = false;
						this.publish();
					}
				}
				dispose() {
					this.disposed = true;
					this.pending.clear();
					this.unsubscribe();
					this.model.dispose();
				}
			};
			//#endregion
			//#region src/shared/settings.ts
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
			const ENTRY_ID = "your-turn";
			/** Package name; the ModuleLoader id and the Cordis patch `name`. */
			const PACKAGE_NAME = "@wu5/dsh-your-turn";
			/** Locale namespace registered through `ctx.locale.register`. */
			const LOCALE_NS = "yourTurn";
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
			/** Fallback voice used when a configured voice is unknown to this build. */
			const FALLBACK_SOUND_PRESET = "chime";
			/** Compiled-in defaults; the Host schema and the browser fallback both read these. */
			const CONFIG_DEFAULTS = Object.freeze({
				surface: "modal",
				autoDismissSeconds: 5,
				soundEnabled: true,
				soundPreset: "chime",
				errorSoundPreset: "alert",
				volume: 70
			});
			/** Clamp helper shared by the schema bounds and the browser-side normalizer. */
			function clamp(value, min, max) {
				if (!Number.isFinite(value)) return min;
				return Math.min(max, Math.max(min, Math.round(value)));
			}
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
			function oneOf(options, fallback, value) {
				return typeof value === "string" && options.includes(value) ? value : fallback;
			}
			function bool(value, fallback) {
				return typeof value === "boolean" ? value : fallback;
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
			function normalizeConfig(input) {
				const raw = typeof input === "object" && input !== null ? input : {};
				return {
					surface: oneOf(SURFACES, CONFIG_DEFAULTS.surface, raw.surface),
					autoDismissSeconds: clamp(typeof raw.autoDismissSeconds === "number" ? raw.autoDismissSeconds : CONFIG_DEFAULTS.autoDismissSeconds, LIMITS.autoDismissSeconds.min, LIMITS.autoDismissSeconds.max),
					soundEnabled: bool(raw.soundEnabled, CONFIG_DEFAULTS.soundEnabled),
					soundPreset: oneOf(SOUND_PRESETS, CONFIG_DEFAULTS.soundPreset, raw.soundPreset),
					errorSoundPreset: oneOf(SOUND_PRESETS, CONFIG_DEFAULTS.errorSoundPreset, raw.errorSoundPreset),
					volume: clamp(typeof raw.volume === "number" ? raw.volume : CONFIG_DEFAULTS.volume, LIMITS.volume.min, LIMITS.volume.max)
				};
			}
			//#endregion
			//#region src/client/fieldSpecs.ts
			/** An empty draft, which the form turns into a clear (revert to the default). */
			const CLEAR = { kind: "clear" };
			/**
			* A boolean field, edited by a switch.
			* @param field - field name inside the settings section.
			* @returns the conversion spec.
			*/
			function boolField(field) {
				return {
					field,
					format: (value) => value === true ? "true" : value === false ? "false" : "",
					parse: (text) => {
						const normalized = text.trim().toLowerCase();
						if (normalized === "") return CLEAR;
						if (normalized === "true" || normalized === "1" || normalized === "on" || normalized === "yes") return {
							kind: "set",
							value: true
						};
						if (normalized === "false" || normalized === "0" || normalized === "off" || normalized === "no") return {
							kind: "set",
							value: false
						};
					}
				};
			}
			/**
			* An integer field with hard bounds matching the Host schema.
			* @param field - field name inside the settings section.
			* @param min - smallest accepted value.
			* @param max - largest accepted value.
			* @returns the conversion spec.
			*/
			function intField(field, min, max) {
				return {
					field,
					format: (value) => typeof value === "number" && Number.isFinite(value) ? String(Math.round(value)) : "",
					parse: (text) => {
						const trimmed = text.trim();
						if (trimmed === "") return CLEAR;
						if (!/^[+-]?\d+$/.test(trimmed)) return void 0;
						const parsed = Number(trimmed);
						if (!Number.isFinite(parsed) || parsed < min || parsed > max) return void 0;
						return {
							kind: "set",
							value: parsed
						};
					}
				};
			}
			/**
			* A closed-vocabulary field, edited by chips or segments.
			* @param field - field name inside the settings section.
			* @param options - every accepted value.
			* @returns the conversion spec.
			*/
			function enumField(field, options) {
				return {
					field,
					format: (value) => typeof value === "string" && options.includes(value) ? value : "",
					parse: (text) => {
						const trimmed = text.trim();
						if (trimmed === "") return CLEAR;
						return options.includes(trimmed) ? {
							kind: "set",
							value: trimmed
						} : void 0;
					}
				};
			}
			//#endregion
			//#region src/client/formSpecs.ts
			const SURFACE_LABELS = SURFACES.map((value) => ({
				value,
				labelKey: `option.surface.${value}`
			}));
			const SOUND_LABELS = SOUND_PRESETS.map((value) => ({
				value,
				labelKey: `option.sound.${value}`
			}));
			/**
			* Preset seconds for the auto-dismiss control. Zero is "never"; every other
			* value is shown in the dropdown with a localised label. The number field that
			* appears under "Custom…" is bounded by the same `LIMITS.autoDismissSeconds`
			* cap, so users can enter any value 0-600 even when none of the presets fit.
			*/
			const DISMISS_PRESETS = [
				0,
				5,
				10,
				30,
				60,
				120,
				300
			];
			const DISMISS_PRESET_LABELS = {
				0: "option.dismiss.never",
				5: "option.dismiss.5s",
				10: "option.dismiss.10s",
				30: "option.dismiss.30s",
				60: "option.dismiss.1m",
				120: "option.dismiss.2m",
				300: "option.dismiss.5m"
			};
			const DISMISS_OPTION_KEYS = [...DISMISS_PRESETS.map((value) => ({
				value: String(value),
				labelKey: DISMISS_PRESET_LABELS[value]
			})), {
				value: "custom",
				labelKey: "option.dismiss.custom"
			}];
			const FIELD_SPECS = [
				enumField("surface", SURFACES),
				intField("autoDismissSeconds", LIMITS.autoDismissSeconds.min, LIMITS.autoDismissSeconds.max),
				boolField("soundEnabled"),
				enumField("soundPreset", SOUND_PRESETS),
				enumField("errorSoundPreset", SOUND_PRESETS),
				intField("volume", LIMITS.volume.min, LIMITS.volume.max)
			];
			const GROUPS = [{
				id: "surface",
				rows: [{
					field: "surface",
					labelKey: "field.surface.label",
					control: {
						kind: "chips",
						optionKeys: SURFACE_LABELS
					}
				}, {
					field: "autoDismissSeconds",
					labelKey: "field.autoDismissSeconds.label",
					control: {
						kind: "select",
						optionKeys: DISMISS_OPTION_KEYS,
						customLabelKey: "option.dismiss.customValue",
						customMin: LIMITS.autoDismissSeconds.min,
						customMax: LIMITS.autoDismissSeconds.max
					}
				}]
			}, {
				id: "sound",
				titleKey: "settings.section.sound",
				rows: [
					{
						field: "soundEnabled",
						labelKey: "field.soundEnabled.label",
						control: { kind: "switch" }
					},
					{
						field: "soundPreset",
						labelKey: "field.soundPreset.label",
						control: {
							kind: "chips",
							optionKeys: SOUND_LABELS
						}
					},
					{
						field: "errorSoundPreset",
						labelKey: "field.errorSoundPreset.label",
						control: {
							kind: "chips",
							optionKeys: SOUND_LABELS
						}
					},
					{
						field: "volume",
						labelKey: "field.volume.label",
						control: {
							kind: "range",
							min: LIMITS.volume.min,
							max: LIMITS.volume.max,
							step: 1
						}
					}
				]
			}];
			GROUPS.flatMap((group) => group.rows.map((row) => row.field));
			/** The select's "custom" sentinel; the value is stored as a plain integer string. */
			const DISMISS_CUSTOM = "custom";
			//#endregion
			//#region src/client/locale.ts
			/**
			* Every string this plugin renders, in both shipped languages.
			*
			* The settings section, the reminder, and the toast all take their copy from
			* here so a locale switch reaches all three; nothing user-visible is inlined in
			* a component.
			*
			* @module dsh-your-turn/client/locale
			*/
			/** The namespace this plugin owns; declared in {@link LocaleNamespaceMap}. */
			const NS = LOCALE_NS;
			/** The dictionaries registered for this plugin's namespace. */
			const DICTS = {
				zh: {
					"title": "轮到你了",
					"headline.completed": "回合已完成",
					"headline.failed": "回合出错了",
					"headline.aborted": "回合已中断",
					"headline.limited": "回合被截断",
					"headline.unknown": "回合已结束",
					"headline.waiting": "等待你继续",
					"meta.turn": "第 {turn} 回合",
					"meta.session": "会话",
					"meta.duration": "用时 {duration}",
					"duration.seconds": "{n} 秒",
					"duration.minutes": "{n} 分钟",
					"duration.minutesSeconds": "{m} 分 {s} 秒",
					"meta.queued": "还有 {count} 条提醒",
					"meta.mutedSession": "该会话已静音",
					"untitledSession": "未命名会话",
					"action.jump": "跳到会话",
					"action.mute": "静音该会话",
					"action.snooze": "5 分钟后再提醒",
					"action.dismiss": "知道了",
					"close": "关闭",
					"toast.text": "{title}：{headline}",
					"toast.jump": "跳到会话",
					"settings.nav": "轮到你了",
					"settings.heading": "轮到你了",
					"settings.intro": "回合结束时显示提醒并播放提示音；DSH 提问、等待你回答时也会响一次，不会额外弹窗遮住问题。",
					"settings.hostStorage": "当前修改保存到台式机的 DSH 部署。",
					"settings.browserStorage": "远程页面：修改仅保存在当前浏览器，不影响台式机或另一台电脑。",
					"settings.selectionHint": "选项和开关点击后自动应用；输入有效值后自动保存，无需保存按钮。",
					"settings.saved": "已保存更改",
					"settings.saveFailed": "修改未保存成功；请检查连接或浏览器存储权限，再次选择或编辑以重试。",
					"settings.unavailable": "当前部署没有向这个页面提供插件设置，本页暂不可编辑。",
					"settings.readOnly": "当前的设置文档是只读的，修改不会被写入。",
					"settings.overridden": "已覆盖",
					"settings.reset": "重置",
					"settings.invalid": "这个值不被接受；修正为有效值后会自动保存。",
					"settings.resetAll": "全部恢复默认",
					"settings.resetAllHint": "点击后立即恢复全部默认设置。",
					"settings.preview": "试听",
					"settings.previewHint": "试听同时会解锁浏览器的音频播放权限。",
					"settings.previewBlocked": "点击「试听」开启声音。",
					"settings.section.surface": "提醒长什么样",
					"settings.section.sound": "提示音",
					"settings.section.scope": "范围与静音",
					"settings.footer": "本机页面保存到 DSH 部署；远程页面保存到当前浏览器。修改自动应用。",
					"field.surface.label": "提醒形式",
					"field.surface.hint": "居中弹窗与顶部横幅显示在页面里。",
					"option.surface.modal": "居中弹窗",
					"option.surface.toast": "顶部横幅",
					"field.autoDismissSeconds.label": "自动消失",
					"field.autoDismissSeconds.hint": "提醒出现这么久后自动关闭；0 表示不自动消失，需要手动关闭。",
					"option.dismiss.never": "从不",
					"option.dismiss.5s": "5 秒",
					"option.dismiss.10s": "10 秒",
					"option.dismiss.30s": "30 秒",
					"option.dismiss.1m": "1 分钟",
					"option.dismiss.2m": "2 分钟",
					"option.dismiss.5m": "5 分钟",
					"option.dismiss.custom": "自定义…",
					"option.dismiss.customValue": "自定义秒数",
					"field.soundEnabled.label": "播放提示音",
					"field.soundEnabled.hint": "回合结束和等待你回答问题时响铃；关闭后仍显示原有提示，但不出声。",
					"field.soundPreset.label": "成功响应",
					"field.soundPreset.hint": "回合正常交接时选用的音色。",
					"field.errorSoundPreset.label": "异常响应",
					"field.errorSoundPreset.hint": "回合出错、被中断或被截断时选用的音色。",
					"option.sound.chime": "风铃",
					"option.sound.ping": "轻点",
					"option.sound.marimba": "马林巴",
					"option.sound.arcade": "街机",
					"option.sound.drop": "水滴",
					"option.sound.alert": "警示",
					"sound.toggle.label": "提示音",
					"sound.toggle.mute": "静音（点击关闭提示音）",
					"sound.toggle.unmute": "开启提示音",
					"sound.pending.one": "1 个未查看的提醒",
					"sound.pending.many": "{count} 个未查看的提醒",
					"sound.pending.openSession": "跳到该会话",
					"field.volume.label": "音量",
					"field.volume.hint": "0 到 100。",
					"field.notifyOn.label": "提醒哪些结果",
					"field.notifyOn.hint": "选择在哪些回合结果上叫你。",
					"option.notifyOn.success": "仅成功",
					"option.notifyOn.success-and-failure": "成功与失败",
					"option.notifyOn.all": "全部（含中断、截断）",
					"field.quietHoursEnabled.label": "免打扰时段",
					"field.quietHoursEnabled.hint": "在这个时间段内不提醒、不出声。",
					"field.quietHoursStart.label": "开始时间",
					"field.quietHoursStart.hint": "本地时间，HH:MM。",
					"field.quietHoursEnd.label": "结束时间",
					"field.quietHoursEnd.hint": "本地时间，HH:MM；早于开始时间表示跨过午夜。",
					"field.muteAll.label": "全部静音",
					"field.muteAll.hint": "临时闭嘴：保留其它设置，但不提醒、不出声。",
					"general.label": "回合交接提醒",
					"general.hint": "Agent 停下来时弹窗并提示音。",
					"status.on": "已开启",
					"status.off": "已关闭",
					"status.muted": "已静音"
				},
				en: {
					"title": "Your turn",
					"headline.completed": "Turn complete",
					"headline.failed": "Turn failed",
					"headline.aborted": "Turn interrupted",
					"headline.limited": "Turn hit a limit",
					"headline.unknown": "Turn ended",
					"headline.waiting": "Waiting for you",
					"meta.turn": "Turn {turn}",
					"meta.session": "Session",
					"meta.duration": "Took {duration}",
					"duration.seconds": "{n}s",
					"duration.minutes": "{n}m",
					"duration.minutesSeconds": "{m}m {s}s",
					"meta.queued": "{count} more waiting",
					"meta.mutedSession": "this session is muted",
					"untitledSession": "Untitled session",
					"action.jump": "Open session",
					"action.mute": "Mute this session",
					"action.snooze": "Remind me in 5 minutes",
					"action.dismiss": "Got it",
					"close": "Close",
					"toast.text": "{title}: {headline}",
					"toast.jump": "Open session",
					"settings.nav": "Your turn",
					"settings.heading": "Your turn",
					"settings.intro": "Show a reminder and play a chime at turn end. A new question waiting for your answer also chimes once, without covering the question card with another popup.",
					"settings.hostStorage": "Changes are saved to this DSH deployment.",
					"settings.browserStorage": "Remote page: changes stay in this browser and do not affect another computer.",
					"settings.selectionHint": "Options and switches apply automatically; valid input saves automatically. No Save button needed.",
					"settings.saved": "Changes saved",
					"settings.saveFailed": "The change was not saved. Check your connection or browser storage permissions, then select or edit again to retry.",
					"settings.unavailable": "This deployment does not serve plugin settings to this page, so the form cannot be edited here.",
					"settings.readOnly": "The settings document is read-only; changes will not be written.",
					"settings.overridden": "overridden",
					"settings.reset": "Reset",
					"settings.invalid": "This value is not accepted; valid input will save automatically.",
					"settings.resetAll": "Reset every field",
					"settings.resetAllHint": "Immediately restore defaults for every field.",
					"settings.preview": "Preview",
					"settings.previewHint": "Previewing also unlocks audio playback for this page.",
					"settings.previewBlocked": "Press Preview to enable audio.",
					"settings.section.surface": "What the reminder looks like",
					"settings.section.sound": "Chime",
					"settings.section.scope": "Scope and silence",
					"settings.footer": "Local pages save to the DSH deployment; remote pages save to this browser. Changes apply automatically.",
					"field.surface.label": "Reminder surface",
					"field.surface.hint": "Modal and banner render in-page.",
					"option.surface.modal": "Centred popup",
					"option.surface.toast": "Top banner",
					"field.autoDismissSeconds.label": "Auto-dismiss",
					"field.autoDismissSeconds.hint": "The reminder closes itself after this long; 0 keeps it until you close it.",
					"option.dismiss.never": "Never",
					"option.dismiss.5s": "5 seconds",
					"option.dismiss.10s": "10 seconds",
					"option.dismiss.30s": "30 seconds",
					"option.dismiss.1m": "1 minute",
					"option.dismiss.2m": "2 minutes",
					"option.dismiss.5m": "5 minutes",
					"option.dismiss.custom": "Custom…",
					"option.dismiss.customValue": "Custom value in seconds",
					"field.soundEnabled.label": "Play a chime",
					"field.soundEnabled.hint": "Chime at turn end and when a question needs your answer. Off keeps the original UI but silences both.",
					"field.soundPreset.label": "Success response",
					"field.soundPreset.hint": "The voice played when the turn handed back cleanly.",
					"field.errorSoundPreset.label": "Failure response",
					"field.errorSoundPreset.hint": "The voice played when the turn failed, was interrupted, or was truncated.",
					"option.sound.chime": "Chime",
					"option.sound.ping": "Ping",
					"option.sound.marimba": "Marimba",
					"option.sound.arcade": "Arcade",
					"option.sound.drop": "Drop",
					"option.sound.alert": "Alert",
					"sound.toggle.label": "Chime",
					"sound.toggle.mute": "Mute the chime",
					"sound.toggle.unmute": "Turn the chime back on",
					"sound.pending.one": "1 unread reminder",
					"sound.pending.many": "{count} unread reminders",
					"sound.pending.openSession": "Open this session",
					"field.volume.label": "Volume",
					"field.volume.hint": "From 0 to 100.",
					"field.notifyOn.label": "Which outcomes remind",
					"field.notifyOn.hint": "Choose the turn outcomes that should call you back.",
					"option.notifyOn.success": "Success only",
					"option.notifyOn.success-and-failure": "Success and failure",
					"option.notifyOn.all": "Everything, including interruptions",
					"field.quietHoursEnabled.label": "Quiet hours",
					"field.quietHoursEnabled.hint": "Nothing is raised or played inside this window.",
					"field.quietHoursStart.label": "Starts at",
					"field.quietHoursStart.hint": "Local time, HH:MM.",
					"field.quietHoursEnd.label": "Ends at",
					"field.quietHoursEnd.hint": "Local time, HH:MM; earlier than the start means the window wraps past midnight.",
					"field.muteAll.label": "Mute everything",
					"field.muteAll.hint": "A temporary silence switch that keeps the rest of your settings.",
					"general.label": "Turn handoff reminder",
					"general.hint": "Popup and chime when the agent stops.",
					"status.on": "On",
					"status.off": "Off",
					"status.muted": "Muted"
				}
			};
			//#endregion
			//#region src/client/localState.ts
			/** Versioned key: an incompatible shape bumps the version instead of migrating. */
			const STORAGE_KEY = "dsh-your-turn/state/v1";
			/** @returns an empty state. */
			function emptyLocalState() {
				return { snoozeUntil: {} };
			}
			/**
			* Read persisted state, dropping anything malformed.
			*
			* @param storage - storage to read; defaults to `window.localStorage`.
			* @returns validated state, or the empty state when nothing usable is stored.
			*/
			function loadLocalState(storage) {
				const target = storage ?? defaultStorage();
				if (target === void 0) return emptyLocalState();
				let raw;
				try {
					raw = target.getItem(STORAGE_KEY);
				} catch {
					return emptyLocalState();
				}
				if (raw === null || raw === "") return emptyLocalState();
				try {
					const parsed = JSON.parse(raw);
					if (typeof parsed !== "object" || parsed === null) return emptyLocalState();
					const record = parsed;
					const snooze = {};
					if (typeof record.snoozeUntil === "object" && record.snoozeUntil !== null) {
						const now = Date.now();
						for (const [id, value] of Object.entries(record.snoozeUntil)) if (typeof value === "number" && Number.isFinite(value) && value > now) snooze[id] = value;
					}
					return { snoozeUntil: snooze };
				} catch {
					return emptyLocalState();
				}
			}
			/**
			* Persist state.
			* @param state - state to write.
			* @param storage - storage to write; defaults to `window.localStorage`.
			* @returns whether the write landed; a refusal is not an error the caller must surface.
			*/
			function saveLocalState(state, storage) {
				const target = storage ?? defaultStorage();
				if (target === void 0) return false;
				try {
					target.setItem(STORAGE_KEY, JSON.stringify({ snoozeUntil: state.snoozeUntil }));
					return true;
				} catch {
					return false;
				}
			}
			/** @returns the page's `localStorage`, when it is reachable. */
			function defaultStorage() {
				try {
					return globalThis.localStorage;
				} catch {
					return;
				}
			}
			//#endregion
			//#region src/client/sound.ts
			const VOICES = {
				chime: [
					{
						freq: 880,
						type: "sine",
						at: 0,
						dur: 1.1,
						gain: .5
					},
					{
						freq: 1320,
						type: "sine",
						at: .02,
						dur: .85,
						gain: .24
					},
					{
						freq: 2637,
						type: "sine",
						at: 0,
						dur: .12,
						gain: .08
					}
				],
				ping: [{
					freq: 1180,
					type: "sine",
					at: 0,
					dur: .18,
					gain: .7
				}],
				marimba: [
					{
						freq: 523.25,
						type: "sine",
						at: 0,
						dur: .5,
						gain: .55
					},
					{
						freq: 1046.5,
						type: "sine",
						at: 0,
						dur: .22,
						gain: .28
					},
					{
						freq: 1568,
						type: "sine",
						at: 0,
						dur: .08,
						gain: .1
					}
				],
				arcade: [
					{
						freq: 659.25,
						type: "square",
						at: 0,
						dur: .075,
						gain: .3
					},
					{
						freq: 880,
						type: "square",
						at: .075,
						dur: .075,
						gain: .3
					},
					{
						freq: 1318.5,
						type: "square",
						at: .15,
						dur: .14,
						gain: .28
					}
				],
				drop: [{
					freq: 900,
					glideTo: 330,
					type: "sine",
					at: 0,
					dur: .34,
					gain: .65
				}],
				alert: [
					{
						freq: 780,
						type: "triangle",
						at: 0,
						dur: .16,
						gain: .5
					},
					{
						freq: 590,
						type: "triangle",
						at: .17,
						dur: .16,
						gain: .5
					},
					{
						freq: 780,
						type: "triangle",
						at: .34,
						dur: .22,
						gain: .46
					}
				]
			};
			/**
			* Loudness staging above full scale: the master gain may reach 1.5, and a
			* hard-knee limiter (threshold -1 dB, ratio 20) keeps simultaneous partials
			* from clipping while the body of every voice gets clearly louder.
			*/
			const MASTER_BOOST = 1.5;
			/**
			* Narrow a raw preset string to a voice this build knows.
			* @param value - configured preset value.
			* @returns a playable preset, or the fallback voice.
			*/
			function resolvePreset(value) {
				if (typeof value === "string" && SOUND_PRESETS.includes(value)) return value;
				return FALLBACK_SOUND_PRESET;
			}
			/**
			* The page's audio output. One instance per plugin instance.
			*
			* Playback is best-effort by design: a browser that has not seen a user gesture
			* keeps its `AudioContext` suspended, so the first chime before any interaction
			* is silently dropped rather than throwing into the render path.
			*/
			var SoundEngine = class {
				context;
				master;
				unavailable = false;
				/**
				* Create or resume the output device.
				*
				* Call this from a user gesture (the settings Preview button, or the first
				* pointer or key event) so the browser releases audio autoplay.
				*
				* @returns whether audio is live after the attempt.
				*/
				async unlock() {
					const context = this.ensureContext();
					if (context === void 0) return false;
					if (context.state === "suspended") try {
						await context.resume();
					} catch (error) {
						console.warn("[dsh-your-turn] audio resume failed", error);
						return false;
					}
					return context.state === "running";
				}
				/** @returns whether the output device currently accepts playback. */
				isUnlocked() {
					return this.context !== void 0 && this.context.state === "running";
				}
				/**
				* Play one voice.
				* @param preset - configured voice; an unknown value plays nothing.
				* @param volume - 0-100, applied on top of the per-voice gain.
				*/
				play(preset, volume) {
					if (volume <= 0) return;
					const context = this.ensureContext();
					if (context === void 0 || this.master === void 0) return;
					this.master.gain.value = Math.max(0, Math.min(100, volume)) / 100 * MASTER_BOOST;
					const voice = VOICES[preset];
					if (voice === void 0) return;
					if (context.state === "suspended") context.resume().catch(() => void 0);
					for (const tone of voice) this.schedule(context, tone);
				}
				/** Release the output device. */
				dispose() {
					const context = this.context;
					this.context = void 0;
					this.master = void 0;
					if (context === void 0) return;
					context.close().catch(() => void 0);
				}
				/** @returns the live master gain node, creating the graph on first use. */
				ensureContext() {
					if (this.context !== void 0) return this.context;
					if (this.unavailable) return void 0;
					const ctor = audioContextConstructor();
					if (ctor === void 0) {
						this.unavailable = true;
						console.warn("[dsh-your-turn] Web Audio is unavailable; chimes are disabled");
						return;
					}
					try {
						const context = new ctor();
						const master = context.createGain();
						master.gain.value = 0;
						const compressor = context.createDynamicsCompressor?.();
						if (compressor === void 0) master.connect(context.destination);
						else {
							compressor.threshold.value = -1;
							compressor.knee.value = 0;
							compressor.ratio.value = 20;
							compressor.attack.value = .001;
							compressor.release.value = .1;
							master.connect(compressor);
							compressor.connect(context.destination);
						}
						this.context = context;
						this.master = master;
						return context;
					} catch (error) {
						this.unavailable = true;
						console.warn("[dsh-your-turn] audio initialisation failed", error);
						return;
					}
				}
				/** Schedule one tone with a click-free attack and an exponential tail. */
				schedule(context, tone) {
					const master = this.master;
					if (master === void 0) return;
					try {
						const start = context.currentTime + tone.at;
						const attack = Math.min(.012, tone.dur * .25);
						const oscillator = context.createOscillator();
						const envelope = context.createGain();
						oscillator.type = tone.type;
						oscillator.frequency.setValueAtTime(tone.freq, start);
						if (tone.glideTo !== void 0) oscillator.frequency.exponentialRampToValueAtTime(tone.glideTo, start + tone.dur);
						envelope.gain.setValueAtTime(1e-4, start);
						envelope.gain.exponentialRampToValueAtTime(Math.max(2e-4, tone.gain), start + attack);
						envelope.gain.exponentialRampToValueAtTime(1e-4, start + tone.dur);
						oscillator.connect(envelope);
						envelope.connect(master);
						oscillator.start(start);
						oscillator.stop(start + tone.dur + .03);
					} catch (error) {
						console.warn("[dsh-your-turn] chime scheduling failed", error);
					}
				}
			};
			/** @returns the window's `AudioContext` constructor, when one exists. */
			function audioContextConstructor() {
				const global = globalThis;
				return global.AudioContext ?? global.webkitAudioContext;
			}
			//#endregion
			//#region src/client/notifier.ts
			/** How long a pushed-back reminder waits before it returns. */
			const SNOOZE_MS = 3e5;
			/** Cross-tab de-duplication window. */
			const DEDUPE_MS = 4e3;
			/**
			* Owns the reminder queue and every browser effect a reminder triggers.
			*/
			var Notifier = class {
				/** Published state; the surfaces subscribe to this. */
				state;
				/** Resolved configuration source, re-published to the surfaces. */
				settingsSnapshot;
				ctx;
				settings;
				sound;
				onUnlockChange;
				local = emptyLocalState();
				snoozeTimers = /* @__PURE__ */ new Map();
				dismissTimers = /* @__PURE__ */ new Map();
				recentRaises = /* @__PURE__ */ new Map();
				recentQuestions = /* @__PURE__ */ new Map();
				channel;
				removeFocusListener;
				disposed = false;
				/**
				* @param ctx - Client Cordis context.
				* @param settings - resolved configuration source.
				* @param sound - the page's chime engine.
				* @param onUnlockChange - notified when audio becomes available, so a settings
				*   page can drop its "the browser has not allowed audio yet" hint.
				*/
				constructor(ctx, settings, sound, onUnlockChange) {
					this.ctx = ctx;
					this.settings = settings;
					this.settingsSnapshot = settings.snapshot;
					this.sound = sound;
					this.onUnlockChange = onUnlockChange;
					this.local = loadLocalState();
					this.state = new Observable({
						reminders: [],
						audioUnlocked: sound.isUnlocked()
					});
					this.openChannel();
					this.watchMainSession();
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
				watchMainSession() {
					let sessions;
					try {
						sessions = this.ctx.get("sessions");
					} catch {
						return;
					}
					if (sessions === void 0) return;
					const reconcile = () => {
						const byId = sessions.list.getSnapshot().byId;
						let opened;
						for (const [id, summary] of Object.entries(byId)) if ((summary?.retainedBy?.mainView ?? 0) > 0) {
							opened = id;
							break;
						}
						if (opened === void 0) return;
						const target = this.state.getSnapshot().reminders.find((r) => r.sessionId === opened);
						if (target === void 0) return;
						this.acknowledge(target.id, false);
					};
					reconcile();
					const unsubscribe = sessions.list.subscribe(reconcile);
					this.ctx.effect(() => () => {
						unsubscribe();
					}, "dsh-your-turn: main session watcher");
				}
				/** @returns the configuration the reminder path reads. */
				get config() {
					return this.settings.config;
				}
				/**
				* Decide whether a finished turn deserves an interruption, and raise it.
				*
				* Every gate is reported at debug level rather than silently swallowed, so a
				* "why did nothing happen" question is answerable from the console.
				*
				* @param record - the observed turn handoff.
				*/
				consider(record) {
					if (this.disposed) return;
					const config = this.config;
					const skip = this.rejection(record, config);
					if (skip !== void 0) {
						console.debug(`[dsh-your-turn] ${record.sessionId}: no reminder (${skip})`);
						return;
					}
					if (this.suppressedByAnotherTab(record.sessionId)) {
						console.debug(`[dsh-your-turn] ${record.sessionId}: another window already raised this reminder`);
						return;
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
						visibleInPopup: true
					});
				}
				/** Questions need attention even in the foreground; do not cover the answer card with another modal. */
				considerQuestion(record) {
					const config = this.config;
					if (this.disposed || !config.soundEnabled) return;
					if (record.subagent) return;
					const key = `${record.sessionId}:${record.key}`;
					const previous = this.recentQuestions.get(key);
					if (previous !== void 0 && Date.now() - previous < DEDUPE_MS) return;
					const at = Date.now();
					this.recentQuestions.set(key, at);
					if (this.recentQuestions.size > 512) this.recentQuestions.delete(this.recentQuestions.keys().next().value);
					this.post({
						kind: "question",
						key,
						at
					});
					this.sound.play(resolvePreset(config.soundPreset), config.volume);
					this.publishAudioState(this.sound.isUnlocked());
				}
				/**
				* Hide the reminder from the popup; the entry stays in the queue so the
				* sidebar-foot tooltip can still list it as "unread". Auto-dismiss uses this
				* path; manual "Got it" / "Snooze" / Esc use {@link acknowledge} to drop the
				* entry entirely.
				* @param id - reminder identity.
				*/
				hideFromPopup(id) {
					const current = this.state.getSnapshot();
					const next = current.reminders.map((reminder) => reminder.id === id ? {
						...reminder,
						visibleInPopup: false
					} : reminder);
					if (next === current.reminders) return;
					this.state.set({
						...current,
						reminders: next
					});
				}
				/**
				* Remove one reminder from the queue entirely. Use this when the user has
				* actually acknowledged it (clicked a session in the sidebar-foot tooltip,
				* pressed Esc, hit "Got it", or snoozed).
				* @param id - reminder identity.
				* @param announce - whether to tell other tabs (false when they told us).
				*/
				acknowledge(id, announce = true) {
					this.clearDismissTimer(id);
					const current = this.state.getSnapshot();
					const target = current.reminders.find((reminder) => reminder.id === id);
					if (target === void 0) return;
					this.state.set({
						...current,
						reminders: current.reminders.filter((reminder) => reminder.id !== id)
					});
					if (announce) this.post({
						kind: "dismissed",
						sessionId: target.sessionId
					});
				}
				/**
				* @deprecated Use {@link acknowledge}. Kept as an alias for callers that
				* already removed the popup and don't want to retitle the action.
				*/
				dismiss(id, announce = true) {
					this.acknowledge(id, announce);
				}
				/** Remove every pending reminder. */
				dismissAll() {
					for (const timer of this.dismissTimers.values()) window.clearTimeout(timer);
					this.dismissTimers.clear();
					const current = this.state.getSnapshot();
					if (current.reminders.length === 0) return;
					this.state.set({
						...current,
						reminders: []
					});
					for (const reminder of current.reminders) this.post({
						kind: "dismissed",
						sessionId: reminder.sessionId
					});
				}
				/** Cancel one reminder's self-dismissal, whatever scheduled it. */
				clearDismissTimer(id) {
					const timer = this.dismissTimers.get(id);
					if (timer === void 0) return;
					window.clearTimeout(timer);
					this.dismissTimers.delete(id);
				}
				/**
				* Push one reminder back by {@link SNOOZE_MS}.
				* @param id - reminder identity.
				*/
				snooze(id) {
					const target = this.state.getSnapshot().reminders.find((reminder) => reminder.id === id);
					if (target === void 0) return;
					this.dismiss(id);
					this.local.snoozeUntil[target.sessionId] = Date.now() + SNOOZE_MS;
					this.persist();
					const timer = window.setTimeout(() => {
						this.snoozeTimers.delete(target.sessionId);
						delete this.local.snoozeUntil[target.sessionId];
						this.persist();
						if (this.sessionRunning(target.sessionId)) return;
						this.raise({
							...target,
							id: `${target.id}:snoozed`,
							raisedAt: Date.now(),
							snoozed: true
						});
					}, SNOOZE_MS);
					this.snoozeTimers.set(target.sessionId, timer);
				}
				/**
				* Create or resume the page's audio output.
				*
				* Safe to call from any user gesture; the settings Preview button and the
				* first pointer or key event both do.
				*
				* @returns whether audio is live afterwards.
				*/
				async unlockAudio() {
					const unlocked = await this.sound.unlock();
					if (unlocked) this.publishAudioState(true);
					return unlocked;
				}
				/**
				* Play one voice now, for the settings Preview button.
				* @param preset - voice to play.
				*/
				preview(preset) {
					const volume = this.config.volume;
					this.unlockAudio().then(() => this.sound.play(preset, volume), () => this.sound.play(preset, volume));
				}
				/** Stop timers, close the cross-tab channel, and restore the title. */
				dispose() {
					this.disposed = true;
					for (const timer of this.snoozeTimers.values()) window.clearTimeout(timer);
					this.snoozeTimers.clear();
					for (const timer of this.dismissTimers.values()) window.clearTimeout(timer);
					this.dismissTimers.clear();
					this.removeFocusListener?.();
					this.removeFocusListener = void 0;
					this.channel?.close();
					this.channel = void 0;
					this.recentQuestions.clear();
				}
				/**
				* Report why a finished turn raises nothing.
				* @param record - observed handoff.
				* @param config - current configuration.
				* @returns a short reason, or undefined when the reminder should be raised.
				*/
				rejection(record, _config) {
					if (record.subagent) return "subagent session";
					const snooze = this.local.snoozeUntil[record.sessionId];
					if (snooze !== void 0 && snooze > Date.now()) return "snoozed";
				}
				/** Enqueue a reminder and fire its effects. */
				raise(reminder) {
					const config = this.config;
					this.recentRaises.set(reminder.sessionId, reminder.raisedAt);
					this.post({
						kind: "raised",
						sessionId: reminder.sessionId,
						at: reminder.raisedAt
					});
					const current = this.state.getSnapshot();
					const queue = [...current.reminders, reminder].slice(-20);
					this.state.set({
						...current,
						reminders: queue
					});
					const autoDismissMs = config.autoDismissSeconds * 1e3;
					if (autoDismissMs > 0) {
						this.clearDismissTimer(reminder.id);
						this.dismissTimers.set(reminder.id, window.setTimeout(() => {
							this.dismissTimers.delete(reminder.id);
							if (this.disposed || this.config.autoDismissSeconds <= 0) return;
							this.hideFromPopup(reminder.id);
						}, autoDismissMs));
					}
					if (config.soundEnabled) {
						const preset = reminder.outcome === "completed" || reminder.outcome === "unknown" ? resolvePreset(config.soundPreset) : resolvePreset(config.errorSoundPreset);
						this.sound.play(preset, config.volume);
						this.publishAudioState(this.sound.isUnlocked());
					}
				}
				/** Publish the audio-unlocked bit. */
				publishAudioState(unlocked) {
					const current = this.state.getSnapshot();
					if (current.audioUnlocked === unlocked) return;
					this.state.set({
						...current,
						audioUnlocked: unlocked
					});
					this.onUnlockChange(unlocked);
				}
				/** Open the same-origin coordination channel, when the browser has one. */
				openChannel() {
					const ctor = globalThis.BroadcastChannel;
					if (ctor === void 0) return;
					try {
						const channel = new ctor("dsh-your-turn");
						channel.onmessage = (event) => {
							const message = event.data;
							if (message === void 0 || typeof message !== "object") return;
							if (message.kind === "question" && typeof message.key === "string" && typeof message.at === "number") {
								this.recentQuestions.set(message.key, message.at);
								if (this.recentQuestions.size > 512) this.recentQuestions.delete(this.recentQuestions.keys().next().value);
								return;
							}
							if (message.kind === "raised") {
								this.recentRaises.set(message.sessionId, message.at);
								return;
							}
							if (message.kind === "dismissed") {
								for (const reminder of this.state.getSnapshot().reminders) if (reminder.sessionId === message.sessionId) this.dismiss(reminder.id, false);
							}
						};
						this.channel = channel;
					} catch (error) {
						console.warn("[dsh-your-turn] cross-tab channel unavailable", error);
					}
				}
				/**
				* @param sessionId - session under consideration.
				* @returns whether another window raised a reminder for it just now.
				*/
				suppressedByAnotherTab(sessionId) {
					const at = this.recentRaises.get(sessionId);
					if (at === void 0) return false;
					return Date.now() - at < DEDUPE_MS;
				}
				/** Announce one action to the other tabs. */
				post(message) {
					try {
						this.channel?.postMessage(message);
					} catch {}
				}
				/** Write the browser-local state, ignoring a refused write. */
				persist() {
					saveLocalState(this.local);
				}
				/** @returns whether a session is currently running, for snooze re-checks. */
				sessionRunning(sessionId) {
					try {
						return (this.ctx.get("sessions")?.list.getSnapshot().byId[sessionId])?.running === true;
					} catch {
						return false;
					}
				}
			};
			//#endregion
			//#region src/client/presentation.ts
			/**
			* @param outcome - classified turn outcome.
			* @returns the dictionary key naming it.
			*/
			function headlineKey(outcome) {
				switch (outcome) {
					case "completed": return "headline.completed";
					case "failed": return "headline.failed";
					case "aborted": return "headline.aborted";
					case "limited": return "headline.limited";
					default: return "headline.unknown";
				}
			}
			/**
			* Render a turn duration in whole seconds, minutes, or minutes and seconds.
			*
			* The key domain is a parameter so the namespace-bound `t` seat stays assignable:
			* `Translate<K>` is contravariant in `K`, and a namespace-bound translate accepts
			* a narrower key union than the unbound alias does.
			*
			* @param t - namespace-bound translate.
			* @param ms - observed duration in milliseconds.
			* @returns localized duration text.
			*/
			function formatDuration(t, ms) {
				const translate = t;
				const total = Math.max(0, Math.round(ms / 1e3));
				if (total < 60) return translate("duration.seconds", { n: total });
				const minutes = Math.floor(total / 60);
				const seconds = total % 60;
				if (seconds === 0) return translate("duration.minutes", { n: minutes });
				return translate("duration.minutesSeconds", {
					m: minutes,
					s: seconds
				});
			}
			//#endregion
			//#region src/client/PopupOverlay.tsx
			/** Root marker every surface of this plugin carries. */
			const ROOT_ATTR$1 = { "data-plugin": "dsh-your-turn" };
			/**
			* Render the configured reminder surfaces for the head of the queue.
			*
			* @param props - injected actions and the localized translate seat.
			* @returns the popup, the banner, or nothing.
			*/
			function ReminderSurface({ t, notifier, openSession }) {
				const state = useSnapshot(notifier.state);
				const settings = useSnapshot(notifier.settingsSnapshot);
				const head = state.reminders.find((reminder) => reminder.visibleInPopup);
				if (head === void 0) return null;
				const showModal = settings.config.surface === "modal";
				const showBanner = settings.config.surface === "toast";
				const queued = state.reminders.length - 1;
				const dismiss = () => notifier.dismiss(head.id);
				const jump = () => {
					openSession(head.sessionId);
					dismiss();
				};
				const body = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshYourTurn yt-reminder",
					...ROOT_ATTR$1,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							className: "yt-reminder__status",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "yt-reminder__dot",
								"data-outcome": head.outcome,
								"aria-hidden": "true"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [t(headlineKey(head.outcome)), head.turn === void 0 ? "" : ` · ${t("meta.turn", { turn: head.turn })}`] })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "yt-reminder__session",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									className: "yt-reminder__title",
									children: head.title === "" ? t("untitledSession") : head.title
								}),
								head.cwd === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "yt-reminder__path",
									children: head.cwd
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
									className: "yt-reminder__meta",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: t("meta.duration", { duration: formatDuration(t, head.durationMs) }) })
								})
							]
						}),
						queued > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "yt-reminder__queued",
							children: t("meta.queued", { count: queued })
						}) : null
					]
				});
				const actions = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshYourTurn yt-reminder__actions",
					...ROOT_ATTR$1,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							size: "sm",
							onClick: () => notifier.snooze(head.id),
							children: t("action.snooze")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							size: "sm",
							onClick: dismiss,
							children: t("action.dismiss")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							size: "sm",
							onClick: jump,
							children: t("action.jump")
						})
					]
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [showBanner ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("aside", {
					className: "dshYourTurn yt-banner",
					...ROOT_ATTR$1,
					role: "status",
					"aria-label": t("title"),
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "yt-banner__text",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: t(headlineKey(head.outcome)) }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: head.title === "" ? t("untitledSession") : head.title }),
							queued > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("meta.queued", { count: queued }) })
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "yt-banner__actions",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							size: "sm",
							onClick: dismiss,
							children: t("action.dismiss")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							size: "sm",
							onClick: jump,
							children: t("toast.jump")
						})]
					})]
				}) : null, showModal ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open: true,
					onClose: dismiss,
					title: t("title"),
					closeLabel: t("close"),
					footer: actions,
					children: body
				}) : null] });
			}
			//#endregion
			//#region src/client/browserSettings.ts
			const BROWSER_SETTINGS_KEY = "dsh-your-turn/settings/v1";
			var BrowserSettings = class {
				state;
				constructor() {
					let user = {};
					try {
						const parsed = JSON.parse(localStorage.getItem("dsh-your-turn/settings/v1") ?? "{}");
						if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
							const normalized = normalizeConfig(parsed);
							for (const key of Object.keys(CONFIG_DEFAULTS)) if (Object.hasOwn(parsed, key)) Object.assign(user, { [key]: normalized[key] });
						}
					} catch {}
					this.state = new Observable({
						status: "ready",
						value: normalizeConfig(user),
						base: CONFIG_DEFAULTS,
						user,
						revision: 0,
						writable: true,
						mode: "memory"
					});
				}
				getSnapshot = () => this.state.getSnapshot();
				subscribe = (listener) => this.state.subscribe(listener);
				async mutate(ops, expectedRevision) {
					const current = this.getSnapshot();
					if (expectedRevision !== void 0 && current.revision !== expectedRevision) return false;
					const user = { ...current.user };
					for (const op of ops) {
						const field = op.path[0];
						if (op.path.length !== 1 || typeof field !== "string" || !Object.hasOwn(CONFIG_DEFAULTS, field)) return false;
						if (op.op === "set") user[field] = op.value;
						else if (op.op === "unset") delete user[field];
						else return false;
					}
					const normalized = normalizeConfig(user);
					for (const op of ops) if (op.op === "set" && normalized[op.path[0]] !== op.value) return false;
					const safeUser = Object.fromEntries(Object.keys(user).map((field) => [field, normalized[field]]));
					try {
						localStorage.setItem(BROWSER_SETTINGS_KEY, JSON.stringify(safeUser));
					} catch {
						return false;
					}
					this.state.set({
						...current,
						user: safeUser,
						value: normalized,
						revision: (current.revision ?? 0) + 1
					});
					return true;
				}
				set = (field, value) => this.mutate([{
					op: "set",
					path: [field],
					value
				}]);
				unset = (field) => this.mutate([{
					op: "unset",
					path: [field]
				}]);
			};
			/** Keep the Host form on local pages; select a distinct browser form only in explicit memory mode. */
			var AdaptiveSettings = class {
				host;
				browser = new BrowserSettings();
				constructor(host) {
					this.host = host;
				}
				active() {
					return this.host.getSnapshot().mode === "memory" ? this.browser : this.host;
				}
				getSnapshot = () => this.active().getSnapshot();
				subscribe = (listener) => {
					const host = this.host.subscribe(listener);
					const browser = this.browser.subscribe(listener);
					return () => {
						host();
						browser();
					};
				};
				mutate = (ops, expectedRevision) => this.active().mutate(ops, expectedRevision);
				set = (field, value) => this.active().set(field, value);
				unset = (field) => this.active().unset(field);
			};
			//#endregion
			//#region src/client/settings.ts
			/**
			* Binds the plugin's settings section and publishes a resolved configuration.
			*
			* `configForms` is one of this plugin's declared Cordis dependencies, so it is
			* present whenever `apply` runs; the guard below covers a composition whose
			* settings service was replaced by something without the form API, which is a
			* broken composition rather than an unsupported one.
			*
			* The official settings wire is loopback-only. An explicitly memory-mode remote
			* page uses a separate browser-local form; inaccessible Host-mode forms stay
			* unavailable/read-only rather than silently masking a Host failure.
			*/
			var SettingsController = class {
				/** Resolved configuration; the single source the reminder path reads. */
				snapshot;
				/** The Host-backed section form, when this composition provides one. */
				form;
				unsubscribe;
				/**
				* @param ctx - Client Cordis context.
				*/
				constructor(ctx) {
					const forms = ctx.configForms;
					if (forms === void 0 || typeof forms.get !== "function") {
						this.form = void 0;
						this.unsubscribe = void 0;
						this.snapshot = new Observable({
							config: normalizeConfig(void 0),
							status: "unavailable",
							writable: false
						});
						return;
					}
					const form = new AdaptiveSettings(forms.get(ENTRY_ID));
					this.form = form;
					const recompute = () => this.recompute(form);
					this.snapshot = new Observable(read(form));
					this.unsubscribe = form.subscribe(recompute);
					recompute();
				}
				/** @returns the current configuration. */
				get config() {
					return this.snapshot.getSnapshot().config;
				}
				/** Release the form subscription. */
				dispose() {
					this.unsubscribe?.();
				}
				/** Republish from the form's latest accepted section. */
				recompute(form) {
					this.snapshot.set(read(form));
				}
			};
			/**
			* Read one form snapshot as resolved settings.
			* @param form - the entry's shared form.
			* @returns the resolved view.
			*/
			function read(form) {
				let state;
				try {
					state = form.getSnapshot();
				} catch (error) {
					console.error("[dsh-your-turn] settings read failed", error);
					return {
						config: normalizeConfig(void 0),
						status: "unavailable",
						writable: false
					};
				}
				return {
					config: normalizeConfig(state.value),
					status: state.status,
					writable: state.writable,
					storage: state.mode === "memory" ? "browser" : "host"
				};
			}
			//#endregion
			//#region src/client/SettingsPage.tsx
			/**
			* The plugin's settings page (`settings.section`).
			*
			* Field formatting and validity use the official model. A field-local write
			* queue applies valid changes automatically; this page intentionally has no Save
			* button and shows only availability, automatic-write progress and failures.
			*
			* @module dsh-your-turn/client/SettingsPage
			*/
			/**
			* Render the settings page.
			*
			* @param props - injected form actions and the localized translate seat.
			* @returns the settings section content.
			*/
			function SettingsPage({ t, form, view, notifier }) {
				const state = useSnapshot(view);
				const disabled = !state.shell.writable;
				if (!state.shell.available) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					role: "status",
					children: t("settings.unavailable")
				});
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [disabled && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					role: "status",
					children: t("settings.readOnly")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshYourTurn yt-settings",
					"data-plugin": "dsh-your-turn",
					children: [GROUPS.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: "yt-settings__group",
						children: [group.titleKey !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
							className: "yt-settings__groupTitle",
							children: t(group.titleKey)
						}), group.rows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Row, {
							t,
							row,
							state: state.fields[row.field],
							disabled,
							onEdit: form.edit,
							onPreview: (preset) => notifier.preview(preset)
						}, row.field))]
					}, group.id)), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SaveFeedback, {
						state,
						t
					})]
				})] });
			}
			/** Fixed-space feedback: acknowledge only committed writes and never move the controls. */
			function SaveFeedback({ state, t }) {
				const version = state.savedVersion ?? 0;
				const seenVersion = (0, react.useRef)(version);
				const [saved, setSaved] = (0, react.useState)(false);
				(0, react.useEffect)(() => {
					if (state.shell.saving || state.shell.failed || state.shell.dirty) {
						setSaved(false);
						return;
					}
					if (version === seenVersion.current) return;
					seenVersion.current = version;
					setSaved(true);
					const timer = window.setTimeout(() => setSaved(false), 2500);
					return () => window.clearTimeout(timer);
				}, [
					version,
					state.shell.saving,
					state.shell.failed,
					state.shell.dirty
				]);
				const visible = state.shell.failed || saved;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "yt-settings__feedback",
					role: "status",
					"aria-live": "polite",
					"aria-atomic": "true",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "yt-settings__feedbackText",
						"data-visible": visible ? "true" : "false",
						"data-error": state.shell.failed ? "true" : "false",
						"aria-hidden": !visible,
						children: state.shell.failed ? t("settings.saveFailed") : version > 0 ? t("settings.saved") : ""
					})
				});
			}
			/** One labelled row. */
			function Row({ t, row, state, disabled, onEdit, onPreview }) {
				const draft = state ?? {
					text: "",
					overridden: false,
					invalid: false
				};
				const label = t(row.labelKey);
				const id = `yt-field-${row.field}`;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "yt-row",
					"data-control": row.control.kind,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "yt-row__label",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
							htmlFor: id,
							children: label
						}), draft.invalid && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "yt-row__hint",
							"data-invalid": "true",
							role: "status",
							children: t("settings.invalid")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "yt-row__control",
						children: control({
							t,
							row,
							id,
							draft,
							disabled,
							onEdit,
							onPreview
						})
					})]
				});
			}
			/** Draw the control one row declares. */
			function control({ t, row, id, draft, disabled, onEdit, onPreview }) {
				const label = t(row.labelKey);
				switch (row.control.kind) {
					case "switch": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
						checked: draft.text === "true",
						label,
						disabled,
						onChange: (next) => onEdit(row.field, next ? "true" : "false")
					});
					case "number": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
						id,
						className: "yt-row__input",
						inputMode: "numeric",
						value: draft.text,
						placeholder: row.control.placeholder,
						disabled,
						"aria-label": label,
						"aria-invalid": draft.invalid,
						onChange: (event) => onEdit(row.field, event.target.value)
					});
					case "range": return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "yt-row__slider",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							id,
							className: "yt-row__range",
							type: "range",
							min: row.control.min,
							max: row.control.max,
							step: row.control.step,
							value: draft.text,
							disabled,
							"aria-label": label,
							"aria-invalid": draft.invalid,
							"aria-valuetext": `${draft.text}%`,
							onChange: (event) => onEdit(row.field, event.target.value)
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("output", {
							className: "yt-row__rangeValue",
							htmlFor: id,
							children: [draft.text, "%"]
						})]
					});
					case "chips": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "yt-row__chips",
						role: "group",
						"aria-label": label,
						id,
						children: row.control.optionKeys.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
							className: "yt-row__chip",
							active: draft.text === option.value,
							"aria-pressed": draft.text === option.value,
							disabled,
							onClick: () => {
								if (disabled) return;
								onEdit(row.field, option.value);
								if (row.field === "soundPreset" || row.field === "errorSoundPreset") onPreview(resolvePreset(option.value));
							},
							children: t(option.labelKey)
						}, option.value))
					}) });
					case "select": return renderSelect({
						t,
						row,
						id,
						draft,
						disabled,
						onEdit
					});
					default: return null;
				}
			}
			/**
			* The preset/auto-dismiss control: a dropdown of fixed durations plus a
			* "Custom…" item that reveals a number input next to it. The persisted value
			* stays a plain integer (seconds), so existing settings documents continue to
			* apply without migration. Zero means "never" — the same convention the prior
			* number input already used.
			*/
			function renderSelect({ t, row, id, draft, disabled, onEdit }) {
				const control = row.control;
				if (control.kind !== "select") return null;
				const [override, setOverride] = (0, react.useState)(null);
				const numeric = Number(draft.text);
				const knownPreset = Number.isFinite(numeric) && DISMISS_PRESETS.includes(numeric);
				const inCustom = override === "custom" || override === null && !knownPreset;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "yt-row__select",
					"data-mode": inCustom ? "custom" : "preset",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
						id,
						className: "yt-row__selectInput",
						value: inCustom ? DISMISS_CUSTOM : String(numeric),
						disabled,
						"aria-label": t(row.labelKey),
						onChange: (event) => {
							const next = event.target.value;
							if (next === "custom") {
								setOverride("custom");
								return;
							}
							setOverride("preset");
							onEdit(row.field, next);
						},
						children: control.optionKeys.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: option.value,
							children: t(option.labelKey)
						}, option.value))
					}), inCustom ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
						className: "yt-row__input",
						inputMode: "numeric",
						value: draft.text,
						placeholder: String(control.customMin),
						min: control.customMin,
						max: control.customMax,
						disabled,
						"aria-label": t(control.customLabelKey),
						"aria-invalid": draft.invalid,
						onChange: (event) => onEdit(row.field, event.target.value)
					}) : null]
				});
			}
			//#endregion
			//#region src/client/SoundToggle.tsx
			/** Root marker every surface of this plugin carries. */
			const ROOT_ATTR = { "data-plugin": "dsh-your-turn" };
			/**
			* Render the sound switch as the sidebar foot's own row.
			*
			* @param props - seat column state, injected form face, view, notifier and `t`.
			* @returns one footer row, or nothing while the settings form is unavailable.
			*/
			function SoundToggle({ t, form, view, notifier, openSession, wide }) {
				const state = useSnapshot(view);
				const notifierState = useSnapshot(notifier.state);
				const field = state.fields.soundEnabled;
				if (field === void 0) return null;
				const on = field.text === "true";
				const disabled = !state.shell.writable;
				const action = t(on ? "sound.toggle.mute" : "sound.toggle.unmute");
				const pending = notifierState.reminders;
				const pendingCount = pending.length;
				const tooltipId = pendingCount > 0 ? "yt-sound-pending" : void 0;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshYourTurn yt-sound",
					...ROOT_ATTR,
					"data-rail": wide ? void 0 : "rail",
					"data-state": on ? "on" : "muted",
					"data-pending": pendingCount > 0 ? "true" : void 0,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "yt-sound__trigger",
						"data-wide": wide ? "wide" : "rail",
						"aria-pressed": on,
						"aria-label": t("sound.toggle.label"),
						"aria-describedby": tooltipId,
						title: action,
						disabled,
						onClick: () => {
							if (disabled) return;
							form.edit("soundEnabled", on ? "false" : "true");
							if (!on) notifier.preview(resolvePreset(state.fields.soundPreset?.text));
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SpeakerIcon, {
							muted: !on,
							size: wide ? 16 : 18
						}), pendingCount > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "yt-sound__badge",
							"aria-hidden": "true",
							children: pendingCount > 9 ? "9+" : pendingCount
						}) : null]
					}), pendingCount > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						id: tooltipId,
						className: "yt-sound__pending",
						role: "tooltip",
						"data-rail": wide ? void 0 : "rail",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "yt-sound__pendingTitle",
							children: pendingCount === 1 ? t("sound.pending.one") : t("sound.pending.many", { count: pendingCount })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
							className: "yt-sound__pendingList",
							children: pending.map((reminder) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "yt-sound__pendingItem",
								onClick: () => {
									openSession(reminder.sessionId);
									notifier.acknowledge(reminder.id);
								},
								title: reminder.cwd ?? reminder.sessionId,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "yt-sound__pendingDot",
									"data-outcome": reminder.outcome,
									"aria-hidden": "true"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "yt-sound__pendingName",
									children: reminder.title || reminder.sessionId
								})]
							}) }, reminder.id))
						})]
					}) : null]
				});
			}
			/**
			* The speaker glyph, drawn the way the shipped sidebar icons are: a 16-box
			* stroke-only SVG in `currentColor`, no literal color anywhere. The audible
			* state adds two waves; the muted state replaces them with an X.
			*
			* @param props - whether sound is off, and the pixel size the seat asks for.
			* @returns the inline SVG element.
			*/
			function SpeakerIcon({ muted, size }) {
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
					className: "yt-sound__glyph",
					width: size,
					height: size,
					viewBox: "0 0 16 16",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.3",
					strokeLinecap: "round",
					strokeLinejoin: "round",
					"aria-hidden": "true",
					focusable: "false",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3.2 6.1h1.9l3.3-2.6v9l-3.3-2.6H3.2z" }), muted ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M10.6 6.4 13.5 9.3" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M13.5 6.4 10.6 9.3" })] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M10.4 6.1a2.7 2.7 0 0 1 0 3.8" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M12.3 4.4a5.2 5.2 0 0 1 0 7.2" })] })]
				});
			}
			//#endregion
			//#region src/client/styles.ts
			/**
			* The plugin's stylesheet, carried as a string.
			*
			* A Web client bundle is one CommonJS factory with no module table for assets
			* and no guarantee that a sibling `.css` file is reachable from the install
			* directory, so the sheet travels inside the bundle and is installed as a
			* single owned `<style>` element. Installation is idempotent, and the disposer
			* removes the element only while the call that returned it is still the current
			* owner, so disabling the plugin leaves nothing behind while a stale instance
			* draining during a hot reload cannot strip a live one's sheet.
			*
			* The element carries BOTH markers the module system keys on, exactly as the
			* shipped client plugins do (`tag.dataset.plugin = '<pkg>'` plus
			* `tag.dataset.pluginCss = '<file>.module.css'`):
			*
			* - `data-plugin-css` de-duplicates installation, so a re-apply updates the
			*   existing sheet instead of stacking a second copy.
			* - `data-plugin` records package ownership. This one is not cosmetic:
			*   `@deepseek-ai/dsh-client-modules` maintains its hot-reload bookkeeping with
			*   it. `claimStyles(id)` adopts every `style:not([data-plugin])` for whichever
			*   module happens to materialize next, and `removeOwnedStyles(id)` deletes every
			*   `style[data-plugin="<id>"]` when a package is reloaded, replaced, pruned, or
			*   when its factory throws. A sheet that never sets `data-plugin` is therefore
			*   claimed by an unrelated plugin and then deleted during that plugin's reload
			*   — which is how this plugin used to lose its whole stylesheet mid-session,
			*   leaving the settings page and the sidebar foot unstyled until a page reload.
			*
			* Every rule is scoped under this plugin's root class or its `data-plugin`
			* attribute: an overlay entry, a settings section, and a settings row are three
			* independent DOM subtrees, and none of them may rely on another's ancestor.
			*
			* @module dsh-your-turn/client/styles
			*/
			/** Attribute marking the installed sheet; also the HMR de-duplication key. */
			const STYLE_ELEMENT_ID = "dsh-your-turn";
			/**
			* Monotonic install serial and the element -> serial map behind it.
			*
			* `installStyles` hands out one disposer per call, but every call resolves the
			* same document-wide element. The serial records which call is the current
			* owner so a superseded disposer cannot remove a sheet a newer instance adopted.
			*/
			let installCount = 0;
			const sheetOwners = /* @__PURE__ */ new WeakMap();
			/** Appearance shared by every surface this plugin mounts. */
			const CSS = `
[data-plugin="dsh-your-turn"] {
  --yt-gap: 12px;
  --yt-radius: var(--dsw-radius-md, 10px);
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family, inherit);
}

/* Persistent banner: the shipped Toast always expires, so it is not used here. */
[data-plugin="dsh-your-turn"].yt-banner {
  position: fixed;
  inset-block-start: 16px;
  inset-inline-start: 50%;
  transform: translateX(-50%);
  inline-size: min(520px, calc(100vw - 32px));
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--yt-radius);
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: var(--dsw-elevation-prominent);
  pointer-events: auto;
}
[data-plugin="dsh-your-turn"] .yt-banner__text {
  flex: 1;
  min-inline-size: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-wrap: anywhere;
  font-size: 0.875em;
}
[data-plugin="dsh-your-turn"] .yt-banner__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/*
 * The sound switch in the sidebar's foot seat (sidebar.footer.action, owned
 * by ui-sidebar, shared with the remote-web-ui phone trigger). The seat's owner
 * positions the row, so this only carries the family geometry the seat expects:
 * a 36px transparent circle in the rail, a growing full-row pill when the
 * column is wide, and the same hover/active/focus tokens the phone trigger
 * uses — no literal colors, so light and dark both come from the theme.
 */
[data-plugin="dsh-your-turn"].yt-sound {
  /*
   * The pending panel below is absolutely positioned with a bottom inset of
   * calc(100% + 8px). Without a positioned ancestor of its own that resolves
   * against the sidebar's footer seat instead of the speaker, so the panel
   * leaves the toggle's box. Anchoring it here is what makes "above the
   * speaker" mean what it says.
   */
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

[data-plugin="dsh-your-turn"].yt-sound[data-rail='rail'] {
  flex-direction: column-reverse;
  gap: 4px;
}

[data-plugin="dsh-your-turn"] .yt-sound__trigger {
  position: relative;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 36px;
  block-size: 36px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
}

[data-plugin="dsh-your-turn"] .yt-sound__trigger[data-wide='wide'] {
  flex: 1 1 auto;
  justify-content: flex-start;
  inline-size: auto;
  min-inline-size: 0;
  border-radius: 999px;
  gap: 8px;
  padding: 0 10px;
}

[data-plugin="dsh-your-turn"] .yt-sound__trigger:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

[data-plugin="dsh-your-turn"] .yt-sound__trigger:active:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-active);
}

[data-plugin="dsh-your-turn"] .yt-sound__trigger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-2), 0 0 0 4px var(--dsw-alias-brand-primary);
}

/* Muted reads as "off" — the glyph changes and the color recedes with it. */
[data-plugin="dsh-your-turn"].yt-sound[data-state='muted'] .yt-sound__trigger:not(:hover) {
  color: var(--dsw-alias-label-tertiary);
}

[data-plugin="dsh-your-turn"] .yt-sound__trigger:disabled {
  opacity: 0.5;
  cursor: default;
}

[data-plugin="dsh-your-turn"] .yt-sound__glyph {
  flex: none;
  display: block;
}

/*
 * The unread badge: a small numeric chip parked on the top-right of the
 * speaker. Visible only while at least one reminder is still pending (raised
 * turn the user has not yet looked at). The hover tooltip is the next block
 * and is what actually lists the session titles.
 */
[data-plugin="dsh-your-turn"] .yt-sound__badge {
  position: absolute;
  inset-block-start: 2px;
  inset-inline-end: 2px;
  min-inline-size: 16px;
  block-size: 16px;
  padding: 0 4px;
  box-sizing: border-box;
  border-radius: 999px;
  background: var(--dsw-alias-state-error-primary, var(--dsw-alias-link));
  color: var(--dsw-alias-label-on-color, #fff);
  font-size: 10px;
  line-height: 14px;
  font-weight: 600;
  text-align: center;
  pointer-events: none;
  transform-origin: center;
  animation: yt-sound-badge-pulse 2.4s ease-in-out infinite;
}
@keyframes yt-sound-badge-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.18); }
}
@media (prefers-reduced-motion: reduce) {
  [data-plugin="dsh-your-turn"] .yt-sound__badge { animation: none; }
}

/*
 * The pending list that appears when the user hovers or focuses the speaker.
 * Anchored above the icon in the rail and wide enough to read a session title.
 * Pure CSS reveal (no JS event handlers), so it inherits the seat's own focus
 * behaviour and never steals pointer or keyboard focus from the toggle.
 */
[data-plugin="dsh-your-turn"] .yt-sound__pending {
  position: absolute;
  inset-block-end: calc(100% + 8px);
  inset-inline-start: 0;
  min-inline-size: 200px;
  max-inline-size: 280px;
  max-block-size: 240px;
  overflow-y: auto;
  padding: 8px;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--yt-radius);
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: var(--dsw-elevation-prominent);
  opacity: 0;
  transform: translateY(4px);
  pointer-events: none;
  transition: opacity 140ms ease, transform 140ms ease;
  z-index: 1;
}
[data-plugin="dsh-your-turn"].yt-sound[data-rail='rail'] .yt-sound__pending {
  inset-inline-start: 0;
  inset-inline-end: auto;
}
[data-plugin="dsh-your-turn"].yt-sound:hover .yt-sound__pending,
[data-plugin="dsh-your-turn"].yt-sound:focus-within .yt-sound__pending {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
@media (prefers-reduced-motion: reduce) {
  [data-plugin="dsh-your-turn"] .yt-sound__pending { transition: none; }
}

[data-plugin="dsh-your-turn"] .yt-sound__pendingTitle {
  margin: 0 0 6px;
  padding: 0 6px;
  font-size: 0.75em;
  line-height: 1.4;
  color: var(--dsw-alias-label-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

[data-plugin="dsh-your-turn"] .yt-sound__pendingList {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

[data-plugin="dsh-your-turn"] .yt-sound__pendingItem {
  display: flex;
  align-items: center;
  gap: 8px;
  inline-size: 100%;
  min-inline-size: 0;
  padding: 6px 8px;
  box-sizing: border-box;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 0.8125em;
  line-height: 1.4;
  text-align: start;
  cursor: pointer;
  transition: background-color 120ms ease;
}
[data-plugin="dsh-your-turn"] .yt-sound__pendingItem:hover,
[data-plugin="dsh-your-turn"] .yt-sound__pendingItem:focus-visible {
  background: var(--dsw-alias-interactive-bg-hover);
  outline: none;
}

[data-plugin="dsh-your-turn"] .yt-sound__pendingDot {
  flex: none;
  inline-size: 8px;
  block-size: 8px;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary);
}
[data-plugin="dsh-your-turn"] .yt-sound__pendingDot[data-outcome="completed"] { background: var(--dsw-alias-state-success-primary); }
[data-plugin="dsh-your-turn"] .yt-sound__pendingDot[data-outcome="failed"] { background: var(--dsw-alias-state-error-primary); }
[data-plugin="dsh-your-turn"] .yt-sound__pendingDot[data-outcome="aborted"] { background: var(--dsw-alias-state-warn-primary); }
[data-plugin="dsh-your-turn"] .yt-sound__pendingDot[data-outcome="limited"] { background: var(--dsw-alias-state-warn-primary); }

[data-plugin="dsh-your-turn"] .yt-sound__pendingName {
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── The reminder in the centred popup ─────────────────────────────────── */

[data-plugin="dsh-your-turn"].yt-reminder {
  display: flex;
  flex-direction: column;
  gap: var(--yt-gap);
  min-width: 0;
}

[data-plugin="dsh-your-turn"] .yt-reminder__status {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 0.875em;
  line-height: 1.5;
  color: var(--dsw-alias-label-secondary);
}

[data-plugin="dsh-your-turn"] .yt-reminder__dot {
  flex: none;
  inline-size: 8px;
  block-size: 8px;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary);
}

[data-plugin="dsh-your-turn"] .yt-reminder__dot[data-outcome="completed"] { background: var(--dsw-alias-state-success-primary); }
[data-plugin="dsh-your-turn"] .yt-reminder__dot[data-outcome="failed"] { background: var(--dsw-alias-state-error-primary); }
[data-plugin="dsh-your-turn"] .yt-reminder__dot[data-outcome="aborted"] { background: var(--dsw-alias-state-warn-primary); }
[data-plugin="dsh-your-turn"] .yt-reminder__dot[data-outcome="limited"] { background: var(--dsw-alias-state-warn-primary); }

[data-plugin="dsh-your-turn"] .yt-reminder__session {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--yt-radius);
  background: var(--dsw-alias-bg-layer-2);
}

[data-plugin="dsh-your-turn"] .yt-reminder__title {
  margin: 0;
  min-width: 0;
  font-size: 1em;
  line-height: 1.45;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
  overflow-wrap: anywhere;
}

[data-plugin="dsh-your-turn"] .yt-reminder__path {
  margin: 0;
  min-width: 0;
  font-family: var(--dsw-font-markdown-code-font-family, ui-monospace, monospace);
  font-size: 0.8125em;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
  overflow-wrap: anywhere;
}

[data-plugin="dsh-your-turn"] .yt-reminder__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.8125em;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}

[data-plugin="dsh-your-turn"] .yt-reminder__queued {
  margin: 0;
  font-size: 0.8125em;
  line-height: 1.5;
  color: var(--dsw-alias-label-secondary);
}

[data-plugin="dsh-your-turn"].yt-reminder__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

/* ── Settings page ─────────────────────────────────────────────────────── */

[data-plugin="dsh-your-turn"].yt-settings {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
  max-inline-size: 720px;
}

[data-plugin="dsh-your-turn"] .yt-settings__intro,
[data-plugin="dsh-your-turn"] .yt-settings__footer {
  margin: 0;
  font-size: 0.875em;
  line-height: 1.6;
  color: var(--dsw-alias-label-secondary);
}

[data-plugin="dsh-your-turn"] .yt-settings__footer {
  color: var(--dsw-alias-label-tertiary);
}

[data-plugin="dsh-your-turn"] .yt-settings__group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

[data-plugin="dsh-your-turn"] .yt-settings__groupTitle {
  margin: 0 0 4px;
  font-size: 0.8125em;
  line-height: 1.5;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-tertiary);
}

[data-plugin="dsh-your-turn"] .yt-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 8px 16px;
  min-width: 0;
  padding: 10px 0;
  border-top: 1px solid var(--dsw-alias-border-l1);
}

[data-plugin="dsh-your-turn"] .yt-settings__group .yt-row:first-of-type { border-top: 0; }

[data-plugin="dsh-your-turn"] .yt-row__label {
  min-width: 0;
  font-size: 0.875em;
  line-height: 1.5;
  color: var(--dsw-alias-label-primary);
}

[data-plugin="dsh-your-turn"] .yt-row__hint {
  margin: 2px 0 0;
  min-width: 0;
  font-size: 0.8125em;
  line-height: 1.55;
  color: var(--dsw-alias-label-tertiary);
  overflow-wrap: anywhere;
}

[data-plugin="dsh-your-turn"] .yt-row__hint[data-invalid="true"] { color: var(--dsw-alias-label-error); }

[data-plugin="dsh-your-turn"] .yt-row__control {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-inline-size: 320px;
}

[data-plugin="dsh-your-turn"] .yt-row__badges {
  display: flex;
  align-items: center;
  gap: 8px;
  grid-column: 1 / -1;
  min-width: 0;
}

/*
 * Chip rows keep every option on one line: the six-voice vocabularies are meant
 * to be read at a glance, so the control column drops its width cap and the
 * chips never wrap. A panel too narrow to hold them scrolls the row instead of
 * stacking it into a second line.
 */
[data-plugin="dsh-your-turn"] .yt-row[data-control="chips"] .yt-row__control {
  max-inline-size: none;
}

[data-plugin="dsh-your-turn"] .yt-row__chips {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: none;
}

[data-plugin="dsh-your-turn"] .yt-row__chips::-webkit-scrollbar { display: none; }

[data-plugin="dsh-your-turn"] .yt-row__chip {
  flex: none;
  padding-inline: 9px;
}

[data-plugin="dsh-your-turn"] .yt-row__chip[aria-pressed="true"] {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  box-shadow: inset 0 0 0 2px var(--dsw-alias-link);
}

[data-plugin="dsh-your-turn"] .yt-settings__feedback {
  position: relative;
  flex: none;
  block-size: 2.8em;
  font-size: 0.8125em;
  line-height: 1.4;
}
[data-plugin="dsh-your-turn"] .yt-settings__feedbackText {
  position: absolute;
  inset-inline: 0;
  inset-block-start: 0;
  max-block-size: 2.8em;
  overflow-y: auto;
  overflow-wrap: anywhere;
  opacity: 0;
  transition: opacity 220ms ease;
  color: var(--dsw-alias-state-success-primary);
}
[data-plugin="dsh-your-turn"] .yt-settings__feedbackText[data-visible="true"] { opacity: 1; }
[data-plugin="dsh-your-turn"] .yt-settings__feedbackText[data-error="true"] { color: var(--dsw-alias-state-error-primary); }
@media (prefers-reduced-motion: reduce) {
  [data-plugin="dsh-your-turn"] .yt-settings__feedbackText { transition: none; }
}

[data-plugin="dsh-your-turn"] .yt-row__slider {
  display: flex;
  align-items: center;
  gap: 10px;
  inline-size: clamp(150px, 22vw, 260px);
  max-inline-size: 100%;
}

[data-plugin="dsh-your-turn"] .yt-row__range {
  flex: 1;
  min-inline-size: 0;
  margin: 0;
  accent-color: var(--dsw-alias-link);
  cursor: pointer;
}

[data-plugin="dsh-your-turn"] .yt-row__range:disabled { cursor: default; }
[data-plugin="dsh-your-turn"] .yt-row__range:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color);
  outline-offset: 3px;
}

[data-plugin="dsh-your-turn"] .yt-row__rangeValue {
  min-inline-size: 4ch;
  text-align: end;
  font-size: 0.875em;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
}

[data-plugin="dsh-your-turn"] .yt-row__input {
  inline-size: 7em;
  text-align: end;
}

/*
 * The preset/auto-dismiss control: a dropdown next to an optional number
 * input. The two share a row that flexes; the number input is removed from
 * layout when the dropdown is on a preset.
 */
[data-plugin="dsh-your-turn"] .yt-row__select {
  display: flex;
  align-items: center;
  gap: 8px;
  min-inline-size: 0;
}
[data-plugin="dsh-your-turn"] .yt-row__selectInput {
  flex: 0 0 auto;
  inline-size: 9.5em;
  padding: 4px 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-sm, 6px);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 0.875em;
  line-height: 1.5;
  cursor: pointer;
}
[data-plugin="dsh-your-turn"] .yt-row__selectInput:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color);
  outline-offset: 2px;
}
[data-plugin="dsh-your-turn"] .yt-row__selectInput:disabled {
  cursor: default;
  opacity: 0.6;
}

[data-plugin="dsh-your-turn"] .yt-row__text {
  inline-size: 6em;
  text-align: center;
}

[data-plugin="dsh-your-turn"] .yt-row__reset {
  border: 0;
  padding: 0;
  background: none;
  font: inherit;
  font-size: 0.8125em;
  line-height: 1.5;
  color: var(--dsw-alias-link);
  cursor: pointer;
}

[data-plugin="dsh-your-turn"] .yt-row__reset:hover { text-decoration: underline; }

[data-plugin="dsh-your-turn"] .yt-row__reset:focus-visible,
[data-plugin="dsh-your-turn"] .yt-row__chip:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color);
  outline-offset: 2px;
}

[data-plugin="dsh-your-turn"] .yt-row__note {
  margin: 0;
  font-size: 0.8125em;
  line-height: 1.5;
  color: var(--dsw-alias-state-warn-label);
}

[data-plugin="dsh-your-turn"] .yt-settings__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

/* The banner is the shipped Toast primitive; it is deliberately unstyled here. */

@media (prefers-reduced-motion: reduce) {
  [data-plugin="dsh-your-turn"] * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
`;
			/**
			* Install the stylesheet once per document.
			*
			* Re-running with the same id adopts the existing element and updates it instead
			* of stacking a second copy, so a hot reload cannot leave a stale sheet winning
			* the cascade. The element is stamped with `data-plugin` ownership on every call
			* — including a call that adopts a sheet some earlier build left untagged — so
			* the module system's hot-reload bookkeeping always sees the sheet as ours.
			*
			* @param doc - the document to install into; defaults to the current one.
			* @returns a disposer removing the element when this call is still its owner.
			*/
			function installStyles(doc = globalThis.document) {
				if (doc === void 0) return () => void 0;
				const selector = `style[data-plugin-css="${STYLE_ELEMENT_ID}"]`;
				let element = doc.head.querySelector(selector);
				if (element === null) {
					element = doc.createElement("style");
					element.dataset.pluginCss = STYLE_ELEMENT_ID;
					doc.head.append(element);
				}
				element.dataset.plugin = PACKAGE_NAME;
				if (element.textContent !== CSS) element.textContent = CSS;
				const owner = ++installCount;
				sheetOwners.set(element, owner);
				return () => {
					if (sheetOwners.get(element) !== owner) return;
					sheetOwners.delete(element);
					element.remove();
				};
			}
			//#endregion
			//#region src/client/turnWatcher.ts
			/**
			* Map a durable `TurnEndReason.kind` to this plugin's outcome vocabulary.
			*
			* `TurnEndReasonMap` is merge-extensible, so an unrecognized kind must resolve
			* to `unknown` rather than throw or be mistaken for a failure.
			*
			* @param kind - raw reason kind.
			* @returns the classified outcome.
			*/
			function classifyReason(kind) {
				switch (kind) {
					case void 0: return "unknown";
					case "completed": return "completed";
					case "error":
					case "blocked": return "failed";
					case "aborted":
					case "interrupted": return "aborted";
					case "max-tokens": return "limited";
					case "forked": return "aborted";
					default: return "unknown";
				}
			}
			/**
			* Observe the Session list and report every turn handoff.
			*
			* The first snapshot seeds state without reporting: a page that loads while a
			* turn is already running must not announce that turn's *start*, and a Session
			* that was already idle has no edge to report.
			*
			* @param ctx - Client Cordis context; must provide the `sessions` service.
			* @param options - callbacks and clock.
			* @returns the watcher handle.
			*/
			function watchTurns(ctx, options) {
				const now = options.now ?? (() => Date.now());
				const observations = /* @__PURE__ */ new Map();
				const observe = () => {
					const sessions = ctx.sessions;
					if (sessions === void 0) return;
					let state;
					try {
						state = sessions.list.getSnapshot();
					} catch (error) {
						console.error("[dsh-your-turn] session list read failed", error);
						return;
					}
					const seen = /* @__PURE__ */ new Set();
					const at = now();
					for (const sessionId of state.ids) {
						const summary = state.byId[sessionId];
						if (summary === void 0) continue;
						seen.add(sessionId);
						const running = summary.running === true;
						const previous = observations.get(sessionId);
						if (previous === void 0) {
							observations.set(sessionId, {
								running,
								since: at,
								ended: running ? void 0 : at
							});
							continue;
						}
						if (previous.running === running) {
							if (running) previous.ended = void 0;
							continue;
						}
						if (running) {
							observations.set(sessionId, {
								running: true,
								since: at,
								ended: void 0
							});
							continue;
						}
						const startedAt = previous.since;
						observations.set(sessionId, {
							running: false,
							since: startedAt,
							ended: at
						});
						const title = summary.displayTitle;
						const exact = readTurnEnd(ctx, sessionId, at);
						const record = {
							sessionId,
							title: title === void 0 || title === "" ? sessionId : title,
							cwd: summary.cwd,
							subagent: summary.origin === "subagent" || summary.parentId !== void 0,
							startedAt,
							endedAt: at,
							durationMs: Math.max(0, at - startedAt),
							turn: exact?.turn,
							outcome: exact === void 0 ? "unknown" : classifyReason(exact.kind),
							reasonKind: exact?.kind
						};
						try {
							options.onTurnEnd(record);
						} catch (error) {
							console.error("[dsh-your-turn] turn handler failed", error);
						}
					}
					for (const sessionId of [...observations.keys()]) if (!seen.has(sessionId)) observations.delete(sessionId);
				};
				const unsubscribe = sessions(ctx)?.list.subscribe(observe);
				observe();
				return {
					dispose() {
						unsubscribe?.();
						observations.clear();
					},
					runningCount() {
						let count = 0;
						for (const observation of observations.values()) if (observation.running) count += 1;
						return count;
					}
				};
			}
			/** @returns the Session service, when this composition provides one. */
			function sessions(ctx) {
				return ctx.sessions;
			}
			/**
			* Read the newest readable `turn/end` record for one Session.
			*
			* The record is only trusted when it is recent relative to the edge being
			* reported: a Session whose conversation is open keeps its whole loaded window,
			* and the *previous* turn's end must not be attributed to this one.
			*
			* @param ctx - Client context.
			* @param sessionId - Session to inspect.
			* @param at - the moment the running flag went false.
			* @returns the reason kind and turn number, when a fresh record was found.
			*/
			function readTurnEnd(ctx, sessionId, at) {
				try {
					const binding = sessions(ctx)?.binding(sessionId);
					if (binding === void 0) return void 0;
					const entries = binding.eventSource.getSnapshot().entries;
					for (let index = entries.length - 1; index >= 0; index -= 1) {
						const entry = entries[index];
						if (entry?.type !== "event") continue;
						const event = entry.event;
						if (event?.type !== "turn/end") continue;
						const time = typeof event.time === "number" ? event.time : void 0;
						if (time !== void 0 && at - time > 1e4) return void 0;
						return {
							kind: event.data?.reason?.kind,
							turn: event.data?.turn
						};
					}
					return;
				} catch (error) {
					console.warn("[dsh-your-turn] turn/end lookup failed", error);
					return;
				}
			}
			//#endregion
			//#region src/client/questionWatcher.ts
			function watchQuestions(ctx, onQuestion) {
				const service = ctx.get("uiSession");
				if (service?.sessionStatus === void 0) return () => void 0;
				const seen = /* @__PURE__ */ new Set();
				const observe = () => {
					for (const [sessionId, status] of service.sessionStatus.getSnapshot()) {
						const question = status.pendingInteraction;
						if (question?.kind !== "question" || typeof question.key !== "string" || question.review !== void 0) continue;
						const identity = `${sessionId}:${question.key}`;
						if (seen.has(identity)) continue;
						seen.add(identity);
						if (seen.size > 512) seen.delete(seen.values().next().value);
						const row = ctx.get("sessions")?.list.getSnapshot().byId[sessionId];
						try {
							onQuestion({
								sessionId,
								key: question.key,
								subagent: row?.origin === "subagent" || row?.parentId !== void 0
							});
						} catch (error) {
							console.error("[dsh-your-turn] question reminder failed", error);
						}
					}
				};
				const unsubscribe = service.sessionStatus.subscribe(observe);
				observe();
				return () => {
					unsubscribe();
					seen.clear();
				};
			}
			//#endregion
			//#region src/client/index.tsx
			/** Cordis plugin name; matches the package name. */
			const name = PACKAGE_NAME;
			/**
			* Hard service dependencies.
			*
			* All four are provided by the shipped Web application bundle. `uiWorkspace` —
			* needed only for the popup's "open session" action — is deliberately absent:
			* it is resolved optionally at call time, so a composition without the
			* Workspace browser still gets reminders, minus one button.
			*/
			const inject = [
				"slots",
				"locale",
				"sessions",
				"configForms"
			];
			/** Slot id of the settings page; also the section key the shell navigates by. */
			const SETTINGS_SECTION_ID = "your-turn";
			/** Slot id of the reminder overlay entry. */
			const OVERLAY_ID = "dsh-your-turn";
			/** Slot id of the sound switch in the sidebar foot. */
			const SOUND_TOGGLE_ID = "dsh-your-turn/sound";
			/**
			* The sidebar foot seat: declared by `@deepseek-ai/dsh-client-ui-sidebar` (its
			* type-only import above brings the declaration in), shared by the shipped
			* settings trigger and the remote-web-ui phone trigger. It is not a hard client
			* edge in `package.json`: `slots.inject` waits for the declaration at runtime,
			* so a reduced composition without that sidebar simply never runs the callback
			* and the switch is absent rather than blocking the plugin.
			*/
			const FOOTER_SEAT = "sidebar.footer.action";
			/**
			* Client plugin body.
			*
			* @param ctx - Client Cordis context.
			*/
			function apply(ctx) {
				ctx.effect(() => ctx.locale.register(NS, DICTS), "dsh-your-turn: locale");
				ctx.effect(() => installStyles(), "dsh-your-turn: styles");
				const settings = new SettingsController(ctx);
				ctx.effect(() => () => settings.dispose(), "dsh-your-turn: settings");
				const sound = new SoundEngine();
				ctx.effect(() => () => sound.dispose(), "dsh-your-turn: audio");
				const notifier = new Notifier(ctx, settings, sound, () => void 0);
				ctx.effect(() => () => notifier.dispose(), "dsh-your-turn: notifier");
				ctx.effect(() => {
					const unlock = () => {
						notifier.unlockAudio();
					};
					window.addEventListener("pointerdown", unlock, {
						once: true,
						passive: true
					});
					window.addEventListener("keydown", unlock, { once: true });
					return () => {
						window.removeEventListener("pointerdown", unlock);
						window.removeEventListener("keydown", unlock);
					};
				}, "dsh-your-turn: audio unlock");
				const watcher = watchTurns(ctx, { onTurnEnd: (record) => notifier.consider(record) });
				ctx.effect(() => () => watcher.dispose(), "dsh-your-turn: turn watcher");
				ctx.inject(["uiSession"], (child) => {
					child.effect(() => watchQuestions(child, (record) => notifier.considerQuestion(record)), "dsh-your-turn: questions");
				});
				const openSession = createSessionOpener(ctx);
				ctx.slots.inject("shell.overlay", () => ctx.slots.register({
					name: "shell.overlay",
					id: OVERLAY_ID,
					order: 40,
					locale: NS,
					inject: () => ({
						notifier,
						openSession
					})
				}, ReminderSurface));
				const scope = settings.form;
				if (scope === void 0) {
					console.warn("[dsh-your-turn] no settings form; the configuration page is unavailable in this composition");
					return;
				}
				const model = new ImmediateSettings(scope, FIELD_SPECS);
				ctx.effect(() => () => model.dispose(), "dsh-your-turn: settings model");
				const view = model.view;
				const actions = model.actions;
				const t = ctx.locale.bind(NS);
				ctx.slots.inject("settings.section", () => ctx.slots.register({
					name: "settings.section",
					id: SETTINGS_SECTION_ID,
					order: 60,
					label: () => t("settings.nav"),
					locale: NS,
					inject: () => ({
						form: actions,
						view,
						notifier
					})
				}, SettingsPage));
				ctx.slots.inject(FOOTER_SEAT, () => ctx.slots.register({
					name: FOOTER_SEAT,
					id: SOUND_TOGGLE_ID,
					order: 10,
					locale: NS,
					inject: () => ({
						form: actions,
						view,
						notifier,
						openSession
					})
				}, SoundToggle));
			}
			/**
			* Build the popup's "open session" action.
			*
			* `ctx.uiWorkspace` is optional: it belongs to the Workspace browser, which a
			* headless or reduced composition may not mount. Resolving it per call keeps the
			* reminder usable either way.
			*
			* @param ctx - Client Cordis context.
			* @returns an action that selects a Session, or a logged no-op when navigation is absent.
			*/
			function createSessionOpener(ctx) {
				return (sessionId) => {
					const workspace = ctx.get("uiWorkspace");
					if (workspace === void 0 || typeof workspace.openSession !== "function") {
						console.info(`[dsh-your-turn] session ${sessionId}: this composition has no Workspace navigation`);
						return;
					}
					try {
						workspace.openSession(sessionId);
					} catch (error) {
						console.warn("[dsh-your-turn] opening the session failed", error);
					}
				};
			}
			//#endregion
			exports.apply = apply;
			exports.inject = inject;
			exports.name = name;
		} catch (error) {
			console.error("[dsh-your-turn] the client bundle failed to initialise; the plugin is inert", error);
			return {
				name: "@wu5/dsh-your-turn",
				inject: [],
				apply() {}
			};
		}
		return module.exports;
	}
});
