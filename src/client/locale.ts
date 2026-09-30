/**
 * Every string this plugin renders, in both shipped languages.
 *
 * The settings section, the reminder, and the toast all take their copy from
 * here so a locale switch reaches all three; nothing user-visible is inlined in
 * a component.
 *
 * @module dsh-your-turn/client/locale
 */

import { LOCALE_NS } from '../shared/settings.ts'

/** The namespace this plugin owns; declared in {@link LocaleNamespaceMap}. */
export const NS = LOCALE_NS

const zh = {
  // ── The reminder itself ───────────────────────────────────────────────────
  'title': '轮到你了',
  'headline.completed': '回合已完成',
  'headline.failed': '回合出错了',
  'headline.aborted': '回合已中断',
  'headline.limited': '回合被截断',
  'headline.unknown': '回合已结束',
  'headline.waiting': '等待你继续',
  'meta.turn': '第 {turn} 回合',
  'meta.session': '会话',
  'meta.duration': '用时 {duration}',
  'duration.seconds': '{n} 秒',
  'duration.minutes': '{n} 分钟',
  'duration.minutesSeconds': '{m} 分 {s} 秒',
  'meta.queued': '还有 {count} 条提醒',
  'meta.mutedSession': '该会话已静音',
  'untitledSession': '未命名会话',
  'action.jump': '跳到会话',
  'action.mute': '静音该会话',
  'action.snooze': '5 分钟后再提醒',
  'action.dismiss': '知道了',
  'close': '关闭',

  // ── Toast fallback ────────────────────────────────────────────────────────
  'toast.text': '{title}：{headline}',
  'toast.jump': '跳到会话',

  // ── Settings page ────────────────────────────────────────────────────────
  'settings.nav': '轮到你了',
  'settings.heading': '轮到你了',
  'settings.intro':
    '当某个会话的 Agent 停下来把回合交还给你时，弹出一个可以真正操作的居中窗口，并播放一段提示音。所有音色都在浏览器里实时合成，插件不携带任何音频文件。',
  'settings.save': '保存',
  'settings.saving': '保存中…',
  'settings.saveFailed': '宿主没有接受这次保存，草稿已保留。',
  'settings.unavailable': '当前部署没有向这个页面提供插件设置，本页暂不可编辑。',
  'settings.readOnly': '当前的设置文档是只读的，修改不会被写入。',
  'settings.overridden': '已覆盖',
  'settings.reset': '重置',
  'settings.invalid': '这个值不被接受，请修正后再保存。',
  'settings.resetAll': '全部恢复默认',
  'settings.resetAllHint': '把每个字段标记为清除；按下「保存」后才真正写入。',
  'settings.preview': '试听',
  'settings.previewHint': '试听同时会解锁浏览器的音频播放权限。',
  'settings.previewBlocked': '浏览器还没允许播放音频，点一下页面任意位置或按「试听」即可解锁。',
  'settings.section.behaviour': '何时提醒',
  'settings.section.surface': '提醒长什么样',
  'settings.section.sound': '提示音',
  'settings.section.scope': '范围与静音',
  'settings.footer':
    '设置保存在当前 profile 的 Cordis patch 里（设置命名空间 your-turn），跟随部署，不跟随浏览器。',

  'field.enabled.label': '启用插件',
  'field.enabled.hint': '关掉后不再监听回合结束，也不会出现任何提示。',

  'field.surface.label': '提醒形式',
  'field.surface.hint': '居中弹窗可以点按钮；顶部横幅更轻，但只有文字可点。',
  'option.surface.modal': '居中弹窗',
  'option.surface.toast': '顶部横幅',
  'option.surface.both': '两者都要',

  'field.autoDismissSeconds.label': '自动关闭（秒）',
  'field.autoDismissSeconds.hint': '0 表示一直留着，直到你手动关掉。',

  'field.soundEnabled.label': '播放提示音',
  'field.soundEnabled.hint': '关掉后只弹窗，不出声。',

  'field.soundPreset.label': '成功音色',
  'field.soundPreset.hint': '回合正常交接时使用。',
  'field.errorSoundPreset.label': '异常音色',
  'field.errorSoundPreset.hint': '回合出错、被中断或被截断时使用。',
  'option.sound.chime': '风铃',
  'option.sound.ping': '轻点',
  'option.sound.marimba': '马林巴',
  'option.sound.arcade': '街机',
  'option.sound.drop': '水滴',
  'option.sound.alert': '警示',
  'option.sound.none': '静音',

  'field.volume.label': '音量',
  'field.volume.hint': '0 到 100。',

  'field.onlyWhenUnfocused.label': '只在离开时提醒',
  'field.onlyWhenUnfocused.hint': '窗口在前台、标签页可见时保持安静——你就坐在屏幕前，不需要被叫。',

  'field.minTurnSeconds.label': '最短回合时长（秒）',
  'field.minTurnSeconds.hint': '比这更短的回合不提醒，避免一问一答时连环响。0 关闭该过滤。',

  'field.includeSubagents.label': '子代理也提醒',
  'field.includeSubagents.hint': '默认关闭：多个子代理会各自结束，容易一次响很多下。',

  'field.notifyOn.label': '提醒哪些结果',
  'field.notifyOn.hint': '选择在哪些回合结果上叫你。',
  'option.notifyOn.success': '仅成功',
  'option.notifyOn.success-and-failure': '成功与失败',
  'option.notifyOn.all': '全部（含中断、截断）',

  'field.systemNotification.label': '同时发系统通知',
  'field.systemNotification.hint': '需要浏览器授予通知权限；仅在页面不可见时发送，并随提醒一起关闭。',

  'field.flashTitle.label': '闪烁标签标题',
  'field.flashTitle.hint': '在标签页标题前反复切换提示文字，直到窗口重新获得焦点。',

  'field.quietHoursEnabled.label': '免打扰时段',
  'field.quietHoursEnabled.hint': '在这个时间段内不提醒、不出声。',

  'field.quietHoursStart.label': '开始时间',
  'field.quietHoursStart.hint': '本地时间，HH:MM。',
  'field.quietHoursEnd.label': '结束时间',
  'field.quietHoursEnd.hint': '本地时间，HH:MM；早于开始时间表示跨过午夜。',

  'field.muteAll.label': '全部静音',
  'field.muteAll.hint': '临时闭嘴：保留其它设置，但不提醒、不出声。',

  'general.label': '回合交接提醒',
  'general.hint': 'Agent 停下来时弹窗并提示音。',
  'status.on': '已开启',
  'status.off': '已关闭',
  'status.muted': '已静音',
} as const

/** Dictionary key union; the type every locale must satisfy. */
export type YourTurnKey = keyof typeof zh

const en: Record<YourTurnKey, string> = {
  'title': 'Your turn',
  'headline.completed': 'Turn complete',
  'headline.failed': 'Turn failed',
  'headline.aborted': 'Turn interrupted',
  'headline.limited': 'Turn hit a limit',
  'headline.unknown': 'Turn ended',
  'headline.waiting': 'Waiting for you',
  'meta.turn': 'Turn {turn}',
  'meta.session': 'Session',
  'meta.duration': 'Took {duration}',
  'duration.seconds': '{n}s',
  'duration.minutes': '{n}m',
  'duration.minutesSeconds': '{m}m {s}s',
  'meta.queued': '{count} more waiting',
  'meta.mutedSession': 'this session is muted',
  'untitledSession': 'Untitled session',
  'action.jump': 'Open session',
  'action.mute': 'Mute this session',
  'action.snooze': 'Remind me in 5 minutes',
  'action.dismiss': 'Got it',
  'close': 'Close',

  'toast.text': '{title}: {headline}',
  'toast.jump': 'Open session',

  'settings.nav': 'Your turn',
  'settings.heading': 'Your turn',
  'settings.intro':
    'When a session\u2019s agent stops and hands the turn back to you, raise a centred popup you can actually act on, and play a chime. Every voice is synthesized in the browser — the plugin ships no audio files.',
  'settings.save': 'Save',
  'settings.saving': 'Saving\u2026',
  'settings.saveFailed': 'The host refused this save; your draft is kept.',
  'settings.unavailable': 'This deployment does not serve plugin settings to this page, so the form cannot be edited here.',
  'settings.readOnly': 'The settings document is read-only; changes will not be written.',
  'settings.overridden': 'overridden',
  'settings.reset': 'Reset',
  'settings.invalid': 'This value is not accepted; fix it before saving.',
  'settings.resetAll': 'Reset every field',
  'settings.resetAllHint': 'Stages a clear for each field; press Save to write it.',
  'settings.preview': 'Preview',
  'settings.previewHint': 'Previewing also unlocks audio playback for this page.',
  'settings.previewBlocked': 'The browser has not allowed audio yet — click anywhere or press Preview to unlock it.',
  'settings.section.behaviour': 'When to remind',
  'settings.section.surface': 'What the reminder looks like',
  'settings.section.sound': 'Chime',
  'settings.section.scope': 'Scope and silence',
  'settings.footer':
    'Settings live in the active profile\u2019s Cordis patch (settings namespace your-turn) — they follow the deployment, not the browser.',

  'field.enabled.label': 'Enable the plugin',
  'field.enabled.hint': 'Off: no turn-end watching and no reminder at all.',

  'field.surface.label': 'Reminder surface',
  'field.surface.hint': 'The centred popup carries buttons; the banner is lighter but only its text takes the pointer.',
  'option.surface.modal': 'Centred popup',
  'option.surface.toast': 'Top banner',
  'option.surface.both': 'Both',

  'field.autoDismissSeconds.label': 'Auto-dismiss (seconds)',
  'field.autoDismissSeconds.hint': '0 keeps the reminder until you close it.',

  'field.soundEnabled.label': 'Play a chime',
  'field.soundEnabled.hint': 'Off: the popup appears silently.',

  'field.soundPreset.label': 'Success voice',
  'field.soundPreset.hint': 'Used when the turn handed back cleanly.',
  'field.errorSoundPreset.label': 'Failure voice',
  'field.errorSoundPreset.hint': 'Used when the turn failed, was interrupted, or was truncated.',
  'option.sound.chime': 'Chime',
  'option.sound.ping': 'Ping',
  'option.sound.marimba': 'Marimba',
  'option.sound.arcade': 'Arcade',
  'option.sound.drop': 'Drop',
  'option.sound.alert': 'Alert',
  'option.sound.none': 'Silent',

  'field.volume.label': 'Volume',
  'field.volume.hint': 'From 0 to 100.',

  'field.onlyWhenUnfocused.label': 'Only while away',
  'field.onlyWhenUnfocused.hint': 'Stay quiet while the window is focused and the tab is visible — you are already looking at it.',

  'field.minTurnSeconds.label': 'Minimum turn length (seconds)',
  'field.minTurnSeconds.hint': 'Shorter turns raise nothing, so a quick back-and-forth does not ring on every message. 0 disables the filter.',

  'field.includeSubagents.label': 'Include subagents',
  'field.includeSubagents.hint': 'Off by default: several subagents finishing at once would ring several times.',

  'field.notifyOn.label': 'Which outcomes remind',
  'field.notifyOn.hint': 'Choose the turn outcomes that should call you back.',
  'option.notifyOn.success': 'Success only',
  'option.notifyOn.success-and-failure': 'Success and failure',
  'option.notifyOn.all': 'Everything, including interruptions',

  'field.systemNotification.label': 'Also send a system notification',
  'field.systemNotification.hint': 'Needs browser notification permission; sent only while the page is hidden and closed with the reminder.',

  'field.flashTitle.label': 'Flash the tab title',
  'field.flashTitle.hint': 'Alternates a marker in the document title until the window regains focus.',

  'field.quietHoursEnabled.label': 'Quiet hours',
  'field.quietHoursEnabled.hint': 'Nothing is raised or played inside this window.',

  'field.quietHoursStart.label': 'Starts at',
  'field.quietHoursStart.hint': 'Local time, HH:MM.',
  'field.quietHoursEnd.label': 'Ends at',
  'field.quietHoursEnd.hint': 'Local time, HH:MM; earlier than the start means the window wraps past midnight.',

  'field.muteAll.label': 'Mute everything',
  'field.muteAll.hint': 'A temporary silence switch that keeps the rest of your settings.',

  'general.label': 'Turn handoff reminder',
  'general.hint': 'Popup and chime when the agent stops.',
  'status.on': 'On',
  'status.off': 'Off',
  'status.muted': 'Muted',
}

/** The dictionaries registered for this plugin's namespace. */
export const DICTS = { zh, en } as const

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** This plugin's copy: the reminder, the toast, and its settings page. */
    yourTurn: YourTurnKey
  }
}
