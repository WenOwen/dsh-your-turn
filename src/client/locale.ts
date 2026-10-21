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
    '回合结束时显示提醒并播放提示音；DSH 提问、等待你回答时也会响一次，不会额外弹窗遮住问题。',
  'settings.hostStorage': '当前修改保存到台式机的 DSH 部署。',
  'settings.browserStorage': '远程页面：修改仅保存在当前浏览器，不影响台式机或另一台电脑。',
  'settings.selectionHint': '选项和开关点击后自动应用；输入有效值后自动保存，无需保存按钮。',
  'settings.saved': '已保存更改',
  'settings.saveFailed': '修改未保存成功；请检查连接或浏览器存储权限，再次选择或编辑以重试。',
  'settings.unavailable': '当前部署没有向这个页面提供插件设置，本页暂不可编辑。',
  'settings.readOnly': '当前的设置文档是只读的，修改不会被写入。',
  'settings.overridden': '已覆盖',
  'settings.reset': '重置',
  'settings.invalid': '这个值不被接受；修正为有效值后会自动保存。',
  'settings.resetAll': '全部恢复默认',
  'settings.resetAllHint': '点击后立即恢复全部默认设置。',
  'settings.preview': '试听',
  'settings.previewHint': '试听同时会解锁浏览器的音频播放权限。',
  'settings.previewBlocked': '点击「试听」开启声音。',
  'settings.section.surface': '提醒长什么样',
  'settings.section.sound': '提示音',
  'settings.section.scope': '范围与静音',
  'settings.footer':
    '本机页面保存到 DSH 部署；远程页面保存到当前浏览器。修改自动应用。',

  'field.surface.label': '提醒形式',
  'field.surface.hint': '居中弹窗与顶部横幅显示在页面里。',
  'option.surface.modal': '居中弹窗',
  'option.surface.toast': '顶部横幅',

  'field.autoDismissSeconds.label': '自动消失',
  'field.autoDismissSeconds.hint': '提醒出现这么久后自动关闭；0 表示不自动消失，需要手动关闭。',
  'option.dismiss.never': '从不',
  'option.dismiss.5s': '5 秒',
  'option.dismiss.10s': '10 秒',
  'option.dismiss.30s': '30 秒',
  'option.dismiss.1m': '1 分钟',
  'option.dismiss.2m': '2 分钟',
  'option.dismiss.5m': '5 分钟',
  'option.dismiss.custom': '自定义…',
  'option.dismiss.customValue': '自定义秒数',

  'field.soundEnabled.label': '播放提示音',
  'field.soundEnabled.hint': '回合结束和等待你回答问题时响铃；关闭后仍显示原有提示，但不出声。',

  'field.soundPreset.label': '成功响应',
  'field.soundPreset.hint': '回合正常交接时选用的音色。',
  'field.errorSoundPreset.label': '异常响应',
  'field.errorSoundPreset.hint': '回合出错、被中断或被截断时选用的音色。',
  'option.sound.chime': '风铃',
  'option.sound.ping': '轻点',
  'option.sound.marimba': '马林巴',
  'option.sound.arcade': '街机',
  'option.sound.drop': '水滴',
  'option.sound.alert': '警示',

  'sound.toggle.label': '提示音',
  'sound.toggle.mute': '静音（点击关闭提示音）',
  'sound.toggle.unmute': '开启提示音',
  'sound.pending.one': '1 个未查看的提醒',
  'sound.pending.many': '{count} 个未查看的提醒',
  'sound.pending.openSession': '跳到该会话',
  'sound.pending.pin': '固定这个列表',
  'sound.pending.unpin': '取消固定',

  'field.volume.label': '音量',
  'field.volume.hint': '0 到 100。',

  'field.notifyOn.label': '提醒哪些结果',
  'field.notifyOn.hint': '选择在哪些回合结果上叫你。',
  'option.notifyOn.success': '仅成功',
  'option.notifyOn.success-and-failure': '成功与失败',
  'option.notifyOn.all': '全部（含中断、截断）',

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
    'Show a reminder and play a chime at turn end. A new question waiting for your answer also chimes once, without covering the question card with another popup.',
  'settings.hostStorage': 'Changes are saved to this DSH deployment.',
  'settings.browserStorage': 'Remote page: changes stay in this browser and do not affect another computer.',
  'settings.selectionHint': 'Options and switches apply automatically; valid input saves automatically. No Save button needed.',
  'settings.saved': 'Changes saved',
  'settings.saveFailed': 'The change was not saved. Check your connection or browser storage permissions, then select or edit again to retry.',
  'settings.unavailable': 'This deployment does not serve plugin settings to this page, so the form cannot be edited here.',
  'settings.readOnly': 'The settings document is read-only; changes will not be written.',
  'settings.overridden': 'overridden',
  'settings.reset': 'Reset',
  'settings.invalid': 'This value is not accepted; valid input will save automatically.',
  'settings.resetAll': 'Reset every field',
  'settings.resetAllHint': 'Immediately restore defaults for every field.',
  'settings.preview': 'Preview',
  'settings.previewHint': 'Previewing also unlocks audio playback for this page.',
  'settings.previewBlocked': 'Press Preview to enable audio.',
  'settings.section.surface': 'What the reminder looks like',
  'settings.section.sound': 'Chime',
  'settings.section.scope': 'Scope and silence',
  'settings.footer':
    'Local pages save to the DSH deployment; remote pages save to this browser. Changes apply automatically.',

  'field.surface.label': 'Reminder surface',
  'field.surface.hint': 'Modal and banner render in-page.',
  'option.surface.modal': 'Centred popup',
  'option.surface.toast': 'Top banner',

  'field.autoDismissSeconds.label': 'Auto-dismiss',
  'field.autoDismissSeconds.hint': 'The reminder closes itself after this long; 0 keeps it until you close it.',
  'option.dismiss.never': 'Never',
  'option.dismiss.5s': '5 seconds',
  'option.dismiss.10s': '10 seconds',
  'option.dismiss.30s': '30 seconds',
  'option.dismiss.1m': '1 minute',
  'option.dismiss.2m': '2 minutes',
  'option.dismiss.5m': '5 minutes',
  'option.dismiss.custom': 'Custom…',
  'option.dismiss.customValue': 'Custom value in seconds',

  'field.soundEnabled.label': 'Play a chime',
  'field.soundEnabled.hint': 'Chime at turn end and when a question needs your answer. Off keeps the original UI but silences both.',

  'field.soundPreset.label': 'Success response',
  'field.soundPreset.hint': 'The voice played when the turn handed back cleanly.',
  'field.errorSoundPreset.label': 'Failure response',
  'field.errorSoundPreset.hint': 'The voice played when the turn failed, was interrupted, or was truncated.',
  'option.sound.chime': 'Chime',
  'option.sound.ping': 'Ping',
  'option.sound.marimba': 'Marimba',
  'option.sound.arcade': 'Arcade',
  'option.sound.drop': 'Drop',
  'option.sound.alert': 'Alert',

  'sound.toggle.label': 'Chime',
  'sound.toggle.mute': 'Mute the chime',
  'sound.toggle.unmute': 'Turn the chime back on',
  'sound.pending.one': '1 unread reminder',
  'sound.pending.many': '{count} unread reminders',
  'sound.pending.openSession': 'Open this session',
  'sound.pending.pin': 'Pin this list',
  'sound.pending.unpin': 'Unpin this list',

  'field.volume.label': 'Volume',
  'field.volume.hint': 'From 0 to 100.',

  'field.notifyOn.label': 'Which outcomes remind',
  'field.notifyOn.hint': 'Choose the turn outcomes that should call you back.',
  'option.notifyOn.success': 'Success only',
  'option.notifyOn.success-and-failure': 'Success and failure',
  'option.notifyOn.all': 'Everything, including interruptions',

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
