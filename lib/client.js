window.__ModuleLoader__.load({
	id: "dsh-your-turn",
	factory: (require) => {
		try {
			var module = { exports: {} };
			var exports = module.exports;
			Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
			let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
			let react = require("react");
			let react_jsx_runtime = require("react/jsx-runtime");
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
			const PACKAGE_NAME = "dsh-your-turn";
			/** Locale namespace registered through `ctx.locale.register`. */
			const LOCALE_NS = "yourTurn";
			/** Where the reminder is drawn. */
			const SURFACES = [
				"modal",
				"toast",
				"both"
			];
			/** Which turn-end outcomes raise a reminder. */
			const NOTIFY_ON = [
				"success",
				"success-and-failure",
				"all"
			];
			/** Built-in chime voices, all synthesized at runtime (no shipped audio assets). */
			const SOUND_PRESETS = [
				"chime",
				"ping",
				"marimba",
				"arcade",
				"drop",
				"alert",
				"none"
			];
			/** Fallback voice used when a configured voice is unknown to this build. */
			const FALLBACK_SOUND_PRESET = "chime";
			/** Compiled-in defaults; the Host schema and the browser fallback both read these. */
			const CONFIG_DEFAULTS = Object.freeze({
				enabled: true,
				surface: "modal",
				autoDismissSeconds: 45,
				soundEnabled: true,
				soundPreset: "chime",
				errorSoundPreset: "alert",
				volume: 70,
				onlyWhenUnfocused: true,
				minTurnSeconds: 3,
				includeSubagents: false,
				notifyOn: "success-and-failure",
				systemNotification: false,
				flashTitle: false,
				quietHoursEnabled: false,
				quietHoursStart: "22:00",
				quietHoursEnd: "08:00",
				muteAll: false
			});
			/** Clamp helper shared by the schema bounds and the browser-side normalizer. */
			function clamp(value, min, max) {
				if (!Number.isFinite(value)) return min;
				return Math.min(max, Math.max(min, Math.round(value)));
			}
			/** Hard bounds; the Host schema and the browser normalizer must agree on these. */
			const LIMITS = Object.freeze({
				autoDismissSeconds: {
					min: 0,
					max: 3600
				},
				volume: {
					min: 0,
					max: 100
				},
				minTurnSeconds: {
					min: 0,
					max: 3600
				}
			});
			function oneOf(options, fallback, value) {
				return typeof value === "string" && options.includes(value) ? value : fallback;
			}
			function bool(value, fallback) {
				return typeof value === "boolean" ? value : fallback;
			}
			/** Accept `HH:MM` (or `H:MM`); anything else falls back. */
			function normalizeClock(value, fallback) {
				if (typeof value === "string") {
					const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
					if (match !== null) {
						const hours = Number(match[1]);
						const minutes = Number(match[2]);
						if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
					}
				}
				return fallback;
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
			function normalizeConfig(input) {
				const raw = typeof input === "object" && input !== null ? input : {};
				return {
					enabled: bool(raw.enabled, CONFIG_DEFAULTS.enabled),
					surface: oneOf(SURFACES, CONFIG_DEFAULTS.surface, raw.surface),
					autoDismissSeconds: clamp(typeof raw.autoDismissSeconds === "number" ? raw.autoDismissSeconds : CONFIG_DEFAULTS.autoDismissSeconds, LIMITS.autoDismissSeconds.min, LIMITS.autoDismissSeconds.max),
					soundEnabled: bool(raw.soundEnabled, CONFIG_DEFAULTS.soundEnabled),
					soundPreset: oneOf(SOUND_PRESETS, CONFIG_DEFAULTS.soundPreset, raw.soundPreset),
					errorSoundPreset: oneOf(SOUND_PRESETS, CONFIG_DEFAULTS.errorSoundPreset, raw.errorSoundPreset),
					volume: clamp(typeof raw.volume === "number" ? raw.volume : CONFIG_DEFAULTS.volume, LIMITS.volume.min, LIMITS.volume.max),
					onlyWhenUnfocused: bool(raw.onlyWhenUnfocused, CONFIG_DEFAULTS.onlyWhenUnfocused),
					minTurnSeconds: clamp(typeof raw.minTurnSeconds === "number" ? raw.minTurnSeconds : CONFIG_DEFAULTS.minTurnSeconds, LIMITS.minTurnSeconds.min, LIMITS.minTurnSeconds.max),
					includeSubagents: bool(raw.includeSubagents, CONFIG_DEFAULTS.includeSubagents),
					notifyOn: oneOf(NOTIFY_ON, CONFIG_DEFAULTS.notifyOn, raw.notifyOn),
					systemNotification: bool(raw.systemNotification, CONFIG_DEFAULTS.systemNotification),
					flashTitle: bool(raw.flashTitle, CONFIG_DEFAULTS.flashTitle),
					quietHoursEnabled: bool(raw.quietHoursEnabled, CONFIG_DEFAULTS.quietHoursEnabled),
					quietHoursStart: normalizeClock(raw.quietHoursStart, CONFIG_DEFAULTS.quietHoursStart),
					quietHoursEnd: normalizeClock(raw.quietHoursEnd, CONFIG_DEFAULTS.quietHoursEnd),
					muteAll: bool(raw.muteAll, CONFIG_DEFAULTS.muteAll)
				};
			}
			/** `HH:MM` parsed to minutes past local midnight, or undefined when malformed. */
			function clockMinutes(value) {
				const match = /^(\d{2}):(\d{2})$/.exec(value);
				if (match === null) return void 0;
				return Number(match[1]) * 60 + Number(match[2]);
			}
			/**
			* Whether a local wall-clock time falls inside a possibly-wrapping quiet window.
			*
			* @param now - minutes past local midnight of the instant under test.
			* @param start - window start in minutes past midnight.
			* @param end - window end in minutes past midnight.
			* @returns true when `now` is inside the window (a start equal to the end is a full day).
			*/
			function insideQuietWindow(now, start, end) {
				if (start === end) return true;
				if (start < end) return now >= start && now < end;
				return now >= start || now < end;
			}
			/**
			* Whether an outcome should raise a reminder under the configured scope.
			*
			* @param notifyOn - configured scope.
			* @param outcome - classified outcome of the finished turn.
			* @returns true when the reminder is in scope.
			*/
			function outcomeInScope(notifyOn, outcome) {
				if (notifyOn === "all") return true;
				if (outcome === "completed" || outcome === "unknown") return true;
				return notifyOn === "success-and-failure" && outcome === "failed";
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
			/**
			* A local wall-clock `HH:MM` field.
			* @param field - field name inside the settings section.
			* @returns the conversion spec.
			*/
			function clockField(field) {
				return {
					field,
					format: (value) => typeof value === "string" ? value : "",
					parse: (text) => {
						const trimmed = text.trim();
						if (trimmed === "") return CLEAR;
						const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
						if (match === null) return void 0;
						const hours = Number(match[1]);
						const minutes = Number(match[2]);
						if (hours > 23 || minutes > 59) return void 0;
						return {
							kind: "set",
							value: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
						};
					}
				};
			}
			//#endregion
			//#region src/client/formSpecs.ts
			/** Dictionary keys for the closed vocabularies the chips render. */
			const SURFACE_LABELS = [
				{
					value: "modal",
					labelKey: "option.surface.modal"
				},
				{
					value: "toast",
					labelKey: "option.surface.toast"
				},
				{
					value: "both",
					labelKey: "option.surface.both"
				}
			];
			const SOUND_LABELS = [
				{
					value: "chime",
					labelKey: "option.sound.chime"
				},
				{
					value: "ping",
					labelKey: "option.sound.ping"
				},
				{
					value: "marimba",
					labelKey: "option.sound.marimba"
				},
				{
					value: "arcade",
					labelKey: "option.sound.arcade"
				},
				{
					value: "drop",
					labelKey: "option.sound.drop"
				},
				{
					value: "alert",
					labelKey: "option.sound.alert"
				},
				{
					value: "none",
					labelKey: "option.sound.none"
				}
			];
			const NOTIFY_LABELS = [
				{
					value: "success",
					labelKey: "option.notifyOn.success"
				},
				{
					value: "success-and-failure",
					labelKey: "option.notifyOn.success-and-failure"
				},
				{
					value: "all",
					labelKey: "option.notifyOn.all"
				}
			];
			/** Staging conversions, in the same order as the layout below. */
			const FIELD_SPECS = [
				boolField("enabled"),
				enumField("surface", SURFACES),
				intField("autoDismissSeconds", LIMITS.autoDismissSeconds.min, LIMITS.autoDismissSeconds.max),
				boolField("soundEnabled"),
				enumField("soundPreset", SOUND_PRESETS),
				enumField("errorSoundPreset", SOUND_PRESETS),
				intField("volume", LIMITS.volume.min, LIMITS.volume.max),
				boolField("onlyWhenUnfocused"),
				intField("minTurnSeconds", LIMITS.minTurnSeconds.min, LIMITS.minTurnSeconds.max),
				boolField("includeSubagents"),
				enumField("notifyOn", NOTIFY_ON),
				boolField("systemNotification"),
				boolField("flashTitle"),
				boolField("quietHoursEnabled"),
				clockField("quietHoursStart"),
				clockField("quietHoursEnd"),
				boolField("muteAll")
			];
			/** The page's groups and rows. */
			const GROUPS = [
				{
					titleKey: "settings.section.behaviour",
					rows: [
						{
							field: "enabled",
							labelKey: "field.enabled.label",
							hintKey: "field.enabled.hint",
							control: { kind: "switch" }
						},
						{
							field: "onlyWhenUnfocused",
							labelKey: "field.onlyWhenUnfocused.label",
							hintKey: "field.onlyWhenUnfocused.hint",
							control: { kind: "switch" }
						},
						{
							field: "minTurnSeconds",
							labelKey: "field.minTurnSeconds.label",
							hintKey: "field.minTurnSeconds.hint",
							control: {
								kind: "number",
								placeholder: "0"
							}
						},
						{
							field: "notifyOn",
							labelKey: "field.notifyOn.label",
							hintKey: "field.notifyOn.hint",
							control: {
								kind: "chips",
								optionKeys: NOTIFY_LABELS
							}
						},
						{
							field: "includeSubagents",
							labelKey: "field.includeSubagents.label",
							hintKey: "field.includeSubagents.hint",
							control: { kind: "switch" }
						}
					]
				},
				{
					titleKey: "settings.section.surface",
					rows: [
						{
							field: "surface",
							labelKey: "field.surface.label",
							hintKey: "field.surface.hint",
							control: {
								kind: "chips",
								optionKeys: SURFACE_LABELS
							}
						},
						{
							field: "autoDismissSeconds",
							labelKey: "field.autoDismissSeconds.label",
							hintKey: "field.autoDismissSeconds.hint",
							control: {
								kind: "number",
								placeholder: "0"
							}
						},
						{
							field: "flashTitle",
							labelKey: "field.flashTitle.label",
							hintKey: "field.flashTitle.hint",
							control: { kind: "switch" }
						},
						{
							field: "systemNotification",
							labelKey: "field.systemNotification.label",
							hintKey: "field.systemNotification.hint",
							control: { kind: "switch" }
						}
					]
				},
				{
					titleKey: "settings.section.sound",
					rows: [
						{
							field: "soundEnabled",
							labelKey: "field.soundEnabled.label",
							hintKey: "field.soundEnabled.hint",
							control: { kind: "switch" }
						},
						{
							field: "soundPreset",
							labelKey: "field.soundPreset.label",
							hintKey: "field.soundPreset.hint",
							control: {
								kind: "chips",
								optionKeys: SOUND_LABELS
							},
							trailing: "preview"
						},
						{
							field: "errorSoundPreset",
							labelKey: "field.errorSoundPreset.label",
							hintKey: "field.errorSoundPreset.hint",
							control: {
								kind: "chips",
								optionKeys: SOUND_LABELS
							}
						},
						{
							field: "volume",
							labelKey: "field.volume.label",
							hintKey: "field.volume.hint",
							control: {
								kind: "number",
								placeholder: "70"
							}
						}
					]
				},
				{
					titleKey: "settings.section.scope",
					rows: [
						{
							field: "quietHoursEnabled",
							labelKey: "field.quietHoursEnabled.label",
							hintKey: "field.quietHoursEnabled.hint",
							control: { kind: "switch" }
						},
						{
							field: "quietHoursStart",
							labelKey: "field.quietHoursStart.label",
							hintKey: "field.quietHoursStart.hint",
							control: { kind: "clock" }
						},
						{
							field: "quietHoursEnd",
							labelKey: "field.quietHoursEnd.label",
							hintKey: "field.quietHoursEnd.hint",
							control: { kind: "clock" }
						},
						{
							field: "muteAll",
							labelKey: "field.muteAll.label",
							hintKey: "field.muteAll.hint",
							control: { kind: "switch" }
						}
					]
				}
			];
			/** Every field the page owns, in layout order. */
			const ALL_FIELDS = GROUPS.flatMap((group) => group.rows.map((row) => row.field));
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
					"settings.intro": "当某个会话的 Agent 停下来把回合交还给你时，弹出一个可以真正操作的居中窗口，并播放一段提示音。所有音色都在浏览器里实时合成，插件不携带任何音频文件。",
					"settings.save": "保存",
					"settings.saving": "保存中…",
					"settings.saveFailed": "宿主没有接受这次保存，草稿已保留。",
					"settings.unavailable": "当前部署没有向这个页面提供插件设置，本页暂不可编辑。",
					"settings.readOnly": "当前的设置文档是只读的，修改不会被写入。",
					"settings.overridden": "已覆盖",
					"settings.reset": "重置",
					"settings.invalid": "这个值不被接受，请修正后再保存。",
					"settings.resetAll": "全部恢复默认",
					"settings.resetAllHint": "把每个字段标记为清除；按下「保存」后才真正写入。",
					"settings.preview": "试听",
					"settings.previewHint": "试听同时会解锁浏览器的音频播放权限。",
					"settings.previewBlocked": "浏览器还没允许播放音频，点一下页面任意位置或按「试听」即可解锁。",
					"settings.section.behaviour": "何时提醒",
					"settings.section.surface": "提醒长什么样",
					"settings.section.sound": "提示音",
					"settings.section.scope": "范围与静音",
					"settings.footer": "设置保存在当前 profile 的 Cordis patch 里（设置命名空间 your-turn），跟随部署，不跟随浏览器。",
					"field.enabled.label": "启用插件",
					"field.enabled.hint": "关掉后不再监听回合结束，也不会出现任何提示。",
					"field.surface.label": "提醒形式",
					"field.surface.hint": "居中弹窗可以点按钮；顶部横幅更轻，但只有文字可点。",
					"option.surface.modal": "居中弹窗",
					"option.surface.toast": "顶部横幅",
					"option.surface.both": "两者都要",
					"field.autoDismissSeconds.label": "自动关闭（秒）",
					"field.autoDismissSeconds.hint": "0 表示一直留着，直到你手动关掉。",
					"field.soundEnabled.label": "播放提示音",
					"field.soundEnabled.hint": "关掉后只弹窗，不出声。",
					"field.soundPreset.label": "成功音色",
					"field.soundPreset.hint": "回合正常交接时使用。",
					"field.errorSoundPreset.label": "异常音色",
					"field.errorSoundPreset.hint": "回合出错、被中断或被截断时使用。",
					"option.sound.chime": "风铃",
					"option.sound.ping": "轻点",
					"option.sound.marimba": "马林巴",
					"option.sound.arcade": "街机",
					"option.sound.drop": "水滴",
					"option.sound.alert": "警示",
					"option.sound.none": "静音",
					"field.volume.label": "音量",
					"field.volume.hint": "0 到 100。",
					"field.onlyWhenUnfocused.label": "只在离开时提醒",
					"field.onlyWhenUnfocused.hint": "窗口在前台、标签页可见时保持安静——你就坐在屏幕前，不需要被叫。",
					"field.minTurnSeconds.label": "最短回合时长（秒）",
					"field.minTurnSeconds.hint": "比这更短的回合不提醒，避免一问一答时连环响。0 关闭该过滤。",
					"field.includeSubagents.label": "子代理也提醒",
					"field.includeSubagents.hint": "默认关闭：多个子代理会各自结束，容易一次响很多下。",
					"field.notifyOn.label": "提醒哪些结果",
					"field.notifyOn.hint": "选择在哪些回合结果上叫你。",
					"option.notifyOn.success": "仅成功",
					"option.notifyOn.success-and-failure": "成功与失败",
					"option.notifyOn.all": "全部（含中断、截断）",
					"field.systemNotification.label": "同时发系统通知",
					"field.systemNotification.hint": "需要浏览器授予通知权限；仅在页面不可见时发送，并随提醒一起关闭。",
					"field.flashTitle.label": "闪烁标签标题",
					"field.flashTitle.hint": "在标签页标题前反复切换提示文字，直到窗口重新获得焦点。",
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
					"settings.intro": "When a session’s agent stops and hands the turn back to you, raise a centred popup you can actually act on, and play a chime. Every voice is synthesized in the browser — the plugin ships no audio files.",
					"settings.save": "Save",
					"settings.saving": "Saving…",
					"settings.saveFailed": "The host refused this save; your draft is kept.",
					"settings.unavailable": "This deployment does not serve plugin settings to this page, so the form cannot be edited here.",
					"settings.readOnly": "The settings document is read-only; changes will not be written.",
					"settings.overridden": "overridden",
					"settings.reset": "Reset",
					"settings.invalid": "This value is not accepted; fix it before saving.",
					"settings.resetAll": "Reset every field",
					"settings.resetAllHint": "Stages a clear for each field; press Save to write it.",
					"settings.preview": "Preview",
					"settings.previewHint": "Previewing also unlocks audio playback for this page.",
					"settings.previewBlocked": "The browser has not allowed audio yet — click anywhere or press Preview to unlock it.",
					"settings.section.behaviour": "When to remind",
					"settings.section.surface": "What the reminder looks like",
					"settings.section.sound": "Chime",
					"settings.section.scope": "Scope and silence",
					"settings.footer": "Settings live in the active profile’s Cordis patch (settings namespace your-turn) — they follow the deployment, not the browser.",
					"field.enabled.label": "Enable the plugin",
					"field.enabled.hint": "Off: no turn-end watching and no reminder at all.",
					"field.surface.label": "Reminder surface",
					"field.surface.hint": "The centred popup carries buttons; the banner is lighter but only its text takes the pointer.",
					"option.surface.modal": "Centred popup",
					"option.surface.toast": "Top banner",
					"option.surface.both": "Both",
					"field.autoDismissSeconds.label": "Auto-dismiss (seconds)",
					"field.autoDismissSeconds.hint": "0 keeps the reminder until you close it.",
					"field.soundEnabled.label": "Play a chime",
					"field.soundEnabled.hint": "Off: the popup appears silently.",
					"field.soundPreset.label": "Success voice",
					"field.soundPreset.hint": "Used when the turn handed back cleanly.",
					"field.errorSoundPreset.label": "Failure voice",
					"field.errorSoundPreset.hint": "Used when the turn failed, was interrupted, or was truncated.",
					"option.sound.chime": "Chime",
					"option.sound.ping": "Ping",
					"option.sound.marimba": "Marimba",
					"option.sound.arcade": "Arcade",
					"option.sound.drop": "Drop",
					"option.sound.alert": "Alert",
					"option.sound.none": "Silent",
					"field.volume.label": "Volume",
					"field.volume.hint": "From 0 to 100.",
					"field.onlyWhenUnfocused.label": "Only while away",
					"field.onlyWhenUnfocused.hint": "Stay quiet while the window is focused and the tab is visible — you are already looking at it.",
					"field.minTurnSeconds.label": "Minimum turn length (seconds)",
					"field.minTurnSeconds.hint": "Shorter turns raise nothing, so a quick back-and-forth does not ring on every message. 0 disables the filter.",
					"field.includeSubagents.label": "Include subagents",
					"field.includeSubagents.hint": "Off by default: several subagents finishing at once would ring several times.",
					"field.notifyOn.label": "Which outcomes remind",
					"field.notifyOn.hint": "Choose the turn outcomes that should call you back.",
					"option.notifyOn.success": "Success only",
					"option.notifyOn.success-and-failure": "Success and failure",
					"option.notifyOn.all": "Everything, including interruptions",
					"field.systemNotification.label": "Also send a system notification",
					"field.systemNotification.hint": "Needs browser notification permission; sent only while the page is hidden and closed with the reminder.",
					"field.flashTitle.label": "Flash the tab title",
					"field.flashTitle.hint": "Alternates a marker in the document title until the window regains focus.",
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
				return {
					mutedSessions: [],
					snoozeUntil: {}
				};
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
					const muted = Array.isArray(record.mutedSessions) ? record.mutedSessions.filter((id) => typeof id === "string" && id !== "").slice(-200) : [];
					const snooze = {};
					if (typeof record.snoozeUntil === "object" && record.snoozeUntil !== null) {
						const now = Date.now();
						for (const [id, value] of Object.entries(record.snoozeUntil)) if (typeof value === "number" && Number.isFinite(value) && value > now) snooze[id] = value;
					}
					return {
						mutedSessions: muted,
						snoozeUntil: snooze
					};
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
					target.setItem(STORAGE_KEY, JSON.stringify({
						mutedSessions: state.mutedSessions.slice(-200),
						snoozeUntil: state.snoozeUntil
					}));
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
					gain: .5
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
						gain: .16
					},
					{
						freq: 880,
						type: "square",
						at: .075,
						dur: .075,
						gain: .16
					},
					{
						freq: 1318.5,
						type: "square",
						at: .15,
						dur: .14,
						gain: .15
					}
				],
				drop: [{
					freq: 900,
					glideTo: 330,
					type: "sine",
					at: 0,
					dur: .34,
					gain: .42
				}],
				alert: [
					{
						freq: 780,
						type: "triangle",
						at: 0,
						dur: .16,
						gain: .36
					},
					{
						freq: 590,
						type: "triangle",
						at: .17,
						dur: .16,
						gain: .36
					},
					{
						freq: 780,
						type: "triangle",
						at: .34,
						dur: .22,
						gain: .34
					}
				]
			};
			/**
			* Narrow a raw preset string to a voice this build knows.
			* @param value - configured preset value.
			* @returns a playable preset, or `none`.
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
				* @param preset - configured voice; `none` or an unknown value plays nothing.
				* @param volume - 0-100, applied on top of the per-voice gain.
				*/
				play(preset, volume) {
					if (preset === "none" || volume <= 0) return;
					const context = this.ensureContext();
					if (context === void 0 || this.master === void 0) return;
					this.master.gain.value = Math.max(0, Math.min(100, volume)) / 100 * .4;
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
						master.connect(context.destination);
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
			/** Interval of the title alternation. */
			const FLASH_INTERVAL_MS = 1200;
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
				timers = /* @__PURE__ */ new Map();
				snoozeTimers = /* @__PURE__ */ new Map();
				recentRaises = /* @__PURE__ */ new Map();
				channel;
				removeFocusListener;
				flashTimer;
				flashBase;
				flashOn = false;
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
						mutedSessions: [...this.local.mutedSessions],
						audioUnlocked: sound.isUnlocked()
					});
					this.openChannel();
					this.watchFocus();
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
						snoozed: false
					});
				}
				/**
				* Remove one reminder from the queue.
				* @param id - reminder identity.
				* @param announce - whether to tell other tabs (false when they told us).
				*/
				dismiss(id, announce = true) {
					const current = this.state.getSnapshot();
					const target = current.reminders.find((reminder) => reminder.id === id);
					if (target === void 0) return;
					this.clearTimer(id);
					this.state.set({
						...current,
						reminders: current.reminders.filter((reminder) => reminder.id !== id)
					});
					this.afterQueueChange();
					if (announce) this.post({
						kind: "dismissed",
						sessionId: target.sessionId
					});
				}
				/** Remove every pending reminder. */
				dismissAll() {
					const current = this.state.getSnapshot();
					if (current.reminders.length === 0) return;
					for (const reminder of current.reminders) this.clearTimer(reminder.id);
					this.state.set({
						...current,
						reminders: []
					});
					this.afterQueueChange();
					for (const reminder of current.reminders) this.post({
						kind: "dismissed",
						sessionId: reminder.sessionId
					});
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
				* Silence one session in this browser.
				* @param sessionId - session to silence.
				*/
				muteSession(sessionId) {
					if (!this.local.mutedSessions.includes(sessionId)) {
						this.local.mutedSessions = [...this.local.mutedSessions, sessionId];
						this.persist();
					}
					const current = this.state.getSnapshot();
					this.state.set({
						...current,
						mutedSessions: [...this.local.mutedSessions]
					});
					for (const reminder of current.reminders.filter((entry) => entry.sessionId === sessionId)) this.dismiss(reminder.id);
				}
				/**
				* Undo {@link muteSession}.
				* @param sessionId - session to unmute.
				*/
				unmuteSession(sessionId) {
					if (!this.local.mutedSessions.includes(sessionId)) return;
					this.local.mutedSessions = this.local.mutedSessions.filter((id) => id !== sessionId);
					this.persist();
					this.state.set({
						...this.state.getSnapshot(),
						mutedSessions: [...this.local.mutedSessions]
					});
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
					for (const id of [...this.timers.keys()]) this.clearTimer(id);
					for (const timer of this.snoozeTimers.values()) window.clearTimeout(timer);
					this.snoozeTimers.clear();
					this.stopTitleFlash();
					this.removeFocusListener?.();
					this.removeFocusListener = void 0;
					this.channel?.close();
					this.channel = void 0;
				}
				/**
				* Report why a finished turn raises nothing.
				* @param record - observed handoff.
				* @param config - current configuration.
				* @returns a short reason, or undefined when the reminder should be raised.
				*/
				rejection(record, config) {
					if (!config.enabled) return "plugin disabled";
					if (config.muteAll) return "muted";
					if (!outcomeInScope(config.notifyOn, record.outcome)) return `outcome ${record.outcome} out of scope`;
					if (record.subagent && !config.includeSubagents) return "subagent session";
					if (record.durationMs < config.minTurnSeconds * 1e3) return `turn shorter than ${String(config.minTurnSeconds)}s`;
					if (this.local.mutedSessions.includes(record.sessionId)) return "session muted";
					const snooze = this.local.snoozeUntil[record.sessionId];
					if (snooze !== void 0 && snooze > Date.now()) return "snoozed";
					if (config.onlyWhenUnfocused && pageAttended()) return "window is attended";
					if (this.inQuietWindow(config)) return "quiet hours";
				}
				/**
				* @param config - current configuration.
				* @returns whether the current local time falls inside the configured quiet window.
				*/
				inQuietWindow(config) {
					if (!config.quietHoursEnabled) return false;
					const start = clockMinutes(config.quietHoursStart);
					const end = clockMinutes(config.quietHoursEnd);
					if (start === void 0 || end === void 0) return false;
					const now = /* @__PURE__ */ new Date();
					return insideQuietWindow(now.getHours() * 60 + now.getMinutes(), start, end);
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
					this.armHead(config);
					if (config.soundEnabled) {
						const preset = reminder.outcome === "completed" || reminder.outcome === "unknown" ? resolvePreset(config.soundPreset) : resolvePreset(config.errorSoundPreset);
						this.sound.play(preset, config.volume);
						this.publishAudioState(this.sound.isUnlocked());
					}
					if (config.systemNotification) this.postSystemNotification(reminder);
					if (config.flashTitle && !pageAttended()) this.startTitleFlash();
				}
				/**
				* Arm the auto-dismiss timer for whichever reminder is on screen.
				*
				* Only the head is timed. Timing the whole queue would let a reminder expire
				* while it was still waiting its turn to be shown, so the user would never see
				* it at all.
				*/
				armHead(config) {
					for (const id of [...this.timers.keys()]) this.clearTimer(id);
					const head = this.state.getSnapshot().reminders[0];
					if (head === void 0 || config.autoDismissSeconds <= 0) return;
					const timer = window.setTimeout(() => {
						this.timers.delete(head.id);
						this.dismiss(head.id);
					}, config.autoDismissSeconds * 1e3);
					this.timers.set(head.id, timer);
				}
				/** Clear one timer. */
				clearTimer(id) {
					const timer = this.timers.get(id);
					if (timer === void 0) return;
					window.clearTimeout(timer);
					this.timers.delete(id);
				}
				/** Re-arm the head's timer, and stop the title flash once nothing is pending. */
				afterQueueChange() {
					this.armHead(this.config);
					if (this.state.getSnapshot().reminders.length === 0) this.stopTitleFlash();
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
				/** Send a best-effort system notification for one reminder. */
				postSystemNotification(reminder) {
					const api = notificationApi();
					if (api === void 0 || api.permission !== "granted") return;
					if (!pageHidden()) return;
					try {
						const notification = new api(reminder.title, {
							body: reminder.cwd ?? reminder.sessionId,
							tag: `dsh-your-turn:${reminder.sessionId}`,
							silent: true
						});
						notification.onclick = () => {
							try {
								globalThis.focus();
							} catch {}
							this.dismiss(reminder.id);
							notification.close();
						};
					} catch (error) {
						console.warn("[dsh-your-turn] system notification failed", error);
					}
				}
				/** Alternate a marker in the document title until the page is attended again. */
				startTitleFlash() {
					if (this.flashTimer !== void 0) return;
					if (typeof document === "undefined") return;
					this.flashBase = document.title;
					this.flashOn = false;
					this.flashTimer = window.setInterval(() => {
						this.flashOn = !this.flashOn;
						document.title = this.flashOn ? `● ${this.flashBase ?? ""}` : this.flashBase ?? "";
					}, FLASH_INTERVAL_MS);
				}
				/** Restore the document title. */
				stopTitleFlash() {
					if (this.flashTimer !== void 0) {
						window.clearInterval(this.flashTimer);
						this.flashTimer = void 0;
					}
					if (this.flashBase !== void 0 && typeof document !== "undefined") document.title = this.flashBase;
					this.flashBase = void 0;
				}
				/** Stop flashing as soon as the page is attended again. */
				watchFocus() {
					if (typeof window === "undefined") return;
					const handler = () => {
						if (!pageAttended()) return;
						this.stopTitleFlash();
					};
					window.addEventListener("focus", handler);
					document?.addEventListener("visibilitychange", handler);
					this.removeFocusListener = () => {
						window.removeEventListener("focus", handler);
						document?.removeEventListener("visibilitychange", handler);
					};
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
			/** @returns whether the page is visible and the window focused. */
			function pageAttended() {
				if (typeof document === "undefined") return false;
				if (document.visibilityState === "hidden") return false;
				if (typeof document.hasFocus === "function") return document.hasFocus();
				return true;
			}
			/** @returns whether the page is not visible. */
			function pageHidden() {
				return typeof document !== "undefined" && document.visibilityState === "hidden";
			}
			/** @returns the Notification constructor, when the browser exposes one. */
			function notificationApi() {
				const api = globalThis.Notification;
				return typeof api === "function" ? api : void 0;
			}
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
			/**
			* The reminder surfaces: the centred popup and the top banner.
			*
			* Both are registered into `shell.overlay`, the frame's additive floating layer.
			* The layer itself is click-through and entries opt back into the pointer, which
			* is exactly right here — the popup is a real dialog with its own focus trap and
			* the banner keeps the shipped primitive's click-through body.
			*
			* Each surface carries this plugin's root marker on its own root node rather
			* than relying on a shared ancestor: the overlay entry, the modal card (a body
			* portal), and the settings page are three unrelated DOM subtrees.
			*
			* @module dsh-your-turn/client/PopupOverlay
			*/
			/** Root marker every surface of this plugin carries. */
			const ROOT_ATTR = { "data-plugin": "dsh-your-turn" };
			/**
			* Render the configured reminder surfaces for the head of the queue.
			*
			* @param props - injected actions and the localized translate seat.
			* @returns the popup, the banner, both, or nothing.
			*/
			function ReminderSurface({ t, notifier, openSession }) {
				const state = useSnapshot(notifier.state);
				const settings = useSnapshot(notifier.settingsSnapshot);
				const [bannerSpentFor, setBannerSpentFor] = (0, react.useState)(void 0);
				const head = state.reminders[0];
				if (head === void 0) return null;
				const surface = settings.config.surface;
				const showModal = surface === "modal" || surface === "both";
				const showBanner = (surface === "toast" || surface === "both") && bannerSpentFor !== head.id;
				const queued = state.reminders.length - 1;
				const dismiss = () => notifier.dismiss(head.id);
				const jump = () => {
					openSession(head.sessionId);
					dismiss();
				};
				const body = /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dshYourTurn yt-reminder",
					...ROOT_ATTR,
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
					...ROOT_ATTR,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "ghost",
							size: "sm",
							onClick: () => notifier.muteSession(head.sessionId),
							children: t("action.mute")
						}),
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
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [showBanner ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
					text: t("toast.text", {
						title: t("title"),
						headline: t(headlineKey(head.outcome))
					}),
					holdMs: bannerHoldMs(settings.config.autoDismissSeconds),
					actions: [{
						label: t("toast.jump"),
						onClick: jump
					}],
					onDone: () => {
						if (showModal) setBannerSpentFor(head.id);
						else dismiss();
					}
				}, head.id) : null, showModal ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open: true,
					onClose: dismiss,
					title: t("title"),
					closeLabel: t("close"),
					footer: actions,
					children: body
				}) : null] });
			}
			/**
			* How long the banner holds.
			*
			* The banner is a cue, not the reminder itself, so it never outlives a short
			* ceiling even when the popup is configured to stay for minutes.
			*
			* @param autoDismissSeconds - configured popup lifetime; 0 means "until dismissed".
			* @returns a hold in milliseconds.
			*/
			function bannerHoldMs(autoDismissSeconds) {
				if (autoDismissSeconds <= 0) return 8e3;
				return Math.max(3e3, Math.min(autoDismissSeconds * 1e3, 8e3));
			}
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
			* A page that cannot reach the Host document — a remote browser keeps settings
			* process-local, and the settings wire is loopback-only — still gets a usable
			* plugin: the snapshot stays on the compiled-in defaults and reports
			* `unavailable`, which is what the settings page renders as its notice.
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
					const form = forms.get(ENTRY_ID);
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
					writable: state.writable
				};
			}
			//#endregion
			//#region src/client/SettingsPage.tsx
			/**
			* Render the settings page.
			*
			* @param props - injected form actions and the localized translate seat.
			* @returns the settings section content.
			*/
			function SettingsPage({ t, form, view, notifier }) {
				const state = useSnapshot(view);
				const queue = useSnapshot(notifier.state);
				const disabled = !state.shell.writable;
				const audioBlocked = !queue.audioUnlocked;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SettingsForm, {
					labels: {
						unavailable: t("settings.unavailable"),
						readOnly: t("settings.readOnly"),
						saveFailed: t("settings.saveFailed"),
						save: t("settings.save"),
						saving: t("settings.saving")
					},
					state: state.shell,
					onSave: form.save,
					onDiscard: form.discard,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dshYourTurn yt-settings",
						"data-plugin": "dsh-your-turn",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "yt-settings__intro",
								children: t("settings.intro")
							}),
							GROUPS.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
								className: "yt-settings__group",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
									className: "yt-settings__groupTitle",
									children: t(group.titleKey)
								}), group.rows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Row, {
									t,
									row,
									state: state.fields[row.field],
									disabled,
									onEdit: form.edit,
									onReset: form.resetField,
									onPreview: () => notifier.preview(resolvePreset(soundPresetOf(state, row.field))),
									previewBlocked: row.trailing === "preview" && audioBlocked
								}, row.field))]
							}, group.titleKey)),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "yt-settings__actions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "ghost",
									size: "sm",
									disabled,
									title: t("settings.resetAllHint"),
									onClick: () => {
										for (const field of ALL_FIELDS) form.resetField(field);
									},
									children: t("settings.resetAll")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "yt-settings__footer",
									children: t("settings.resetAllHint")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "yt-settings__footer",
								children: t("settings.footer")
							})
						]
					})
				});
			}
			/** Read the staged/draft sound preset for the Preview action. */
			function soundPresetOf(state, field) {
				const text = state.fields[field]?.text;
				return resolvePreset(text === void 0 || text === "" ? void 0 : text);
			}
			/** One labelled row. */
			function Row({ t, row, state, disabled, onEdit, onReset, onPreview, previewBlocked }) {
				const draft = state ?? {
					text: "",
					overridden: false,
					invalid: false
				};
				const label = t(row.labelKey);
				const id = `yt-field-${row.field}`;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "yt-row",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "yt-row__label",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
								htmlFor: id,
								children: label
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "yt-row__hint",
								"data-invalid": draft.invalid ? "true" : "false",
								children: draft.invalid ? t("settings.invalid") : t(row.hintKey)
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "yt-row__control",
							children: control({
								t,
								row,
								id,
								draft,
								disabled,
								onEdit,
								onPreview,
								previewBlocked
							})
						}),
						draft.overridden ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "yt-row__badges",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
								tone: "quiet",
								children: t("settings.overridden")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "yt-row__reset",
								disabled,
								onClick: () => onReset(row.field),
								children: t("settings.reset")
							})]
						}) : null
					]
				});
			}
			/** Draw the control one row declares. */
			function control({ t, row, id, draft, disabled, onEdit, onPreview, previewBlocked }) {
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
					case "clock": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
						id,
						className: "yt-row__text",
						inputMode: "numeric",
						value: draft.text,
						placeholder: "HH:MM",
						disabled,
						"aria-label": label,
						"aria-invalid": draft.invalid,
						onChange: (event) => onEdit(row.field, event.target.value)
					});
					case "chips": return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "yt-row__chips",
							role: "group",
							"aria-label": label,
							id,
							children: row.control.optionKeys.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
								className: "yt-row__chip",
								active: draft.text === option.value,
								disabled,
								onClick: () => {
									if (!disabled) onEdit(row.field, option.value);
								},
								children: t(option.labelKey)
							}, option.value))
						}),
						row.trailing === "preview" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							size: "sm",
							title: t("settings.previewHint"),
							onClick: onPreview,
							children: t("settings.preview")
						}) : null,
						previewBlocked ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "yt-row__note",
							children: t("settings.previewBlocked")
						}) : null
					] });
					default: return null;
				}
			}
			//#endregion
			//#region src/client/styles.ts
			/**
			* The plugin's stylesheet, carried as a string.
			*
			* A Web client bundle is one CommonJS factory with no module table for assets
			* and no guarantee that a sibling `.css` file is reachable from the install
			* directory, so the sheet travels inside the bundle and is installed as a
			* single owned `<style data-plugin-css>` element. Installation is idempotent and
			* the disposer removes the element, so disabling the plugin leaves nothing
			* behind.
			*
			* Every rule is scoped under this plugin's root class or its `data-plugin`
			* attribute: an overlay entry, a settings section, and a settings row are three
			* independent DOM subtrees, and none of them may rely on another's ancestor.
			*
			* @module dsh-your-turn/client/styles
			*/
			/** Attribute marking the installed sheet; also the HMR de-duplication key. */
			const STYLE_ELEMENT_ID = "dsh-your-turn";
			/** Appearance shared by every surface this plugin mounts. */
			const CSS = `
[data-plugin="dsh-your-turn"] {
  --yt-gap: 12px;
  --yt-radius: var(--dsw-radius-md, 10px);
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family, inherit);
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

[data-plugin="dsh-your-turn"] .yt-row__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

[data-plugin="dsh-your-turn"] .yt-row__input {
  inline-size: 7em;
  text-align: end;
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
			* Re-running with the same id updates the existing element instead of stacking a
			* second copy, so a hot reload cannot leave a stale sheet winning the cascade.
			*
			* @param doc - the document to install into; defaults to the current one.
			* @returns a disposer removing the element this call owns.
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
				if (element.textContent !== CSS) element.textContent = CSS;
				return () => {
					element?.remove();
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
				const model = new _deepseek_ai_dsh_client_ui_primitives.SettingsFormModel(scope, [...FIELD_SPECS]);
				ctx.effect(() => () => model.dispose(), "dsh-your-turn: settings model");
				const view = model.bind(() => ({
					shell: model.shell(),
					fields: Object.fromEntries(FIELD_SPECS.map((spec) => [spec.field, model.field(spec.field)]))
				}));
				const actions = model.actions();
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
				name: "dsh-your-turn",
				inject: [],
				apply() {}
			};
		}
		return module.exports;
	}
});
