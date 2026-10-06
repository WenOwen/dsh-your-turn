/**
 * dsh-your-turn — browser half.
 *
 * Wiring only: register the copy, install the stylesheet, bind the settings
 * section, start the turn watcher, and register the two Slot contributions.
 * Every decision lives in the module that owns it — {@link Notifier} for
 * whether to interrupt, {@link SettingsController} for what the user asked for,
 * {@link watchTurns} for when a turn ends.
 *
 * @module dsh-your-turn/client
 */

// Type-only: these imports pull the official `declare module '@deepseek-ai/cordis'`
// augmentations into the program so `ctx.slots`, `ctx.locale`, `ctx.sessions`,
// and `ctx.configForms` are the real services. They are erased at build time and
// add no `require(...)` edge to the bundle.
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'

import type { Context } from '@deepseek-ai/cordis'
import { ImmediateSettings } from './immediateSettings.ts'
import { PACKAGE_NAME } from '../shared/settings.ts'
import { FIELD_SPECS } from './formSpecs.ts'
import { DICTS, NS } from './locale.ts'
import { Notifier } from './notifier.ts'
import { ReminderSurface } from './PopupOverlay.tsx'
import { SettingsController } from './settings.ts'
import { SettingsPage } from './SettingsPage.tsx'
import { SoundEngine } from './sound.ts'
import { SoundToggle } from './SoundToggle.tsx'
import { installStyles } from './styles.ts'
import { watchTurns } from './turnWatcher.ts'
import { watchQuestions } from './questionWatcher.ts'

/** Cordis plugin name; matches the package name. */
export const name = PACKAGE_NAME

/**
 * Hard service dependencies.
 *
 * All four are provided by the shipped Web application bundle. `uiWorkspace` —
 * needed only for the popup's "open session" action — is deliberately absent:
 * it is resolved optionally at call time, so a composition without the
 * Workspace browser still gets reminders, minus one button.
 */
export const inject = ['slots', 'locale', 'sessions', 'configForms'] as const

/** Slot id of the settings page; also the section key the shell navigates by. */
const SETTINGS_SECTION_ID = 'your-turn'

/** Slot id of the reminder overlay entry. */
const OVERLAY_ID = 'dsh-your-turn'

/** Slot id of the sound switch in the sidebar foot. */
const SOUND_TOGGLE_ID = 'dsh-your-turn/sound'

/**
 * The sidebar foot seat: declared by `@deepseek-ai/dsh-client-ui-sidebar` (its
 * type-only import above brings the declaration in), shared by the shipped
 * settings trigger and the remote-web-ui phone trigger. It is not a hard client
 * edge in `package.json`: `slots.inject` waits for the declaration at runtime,
 * so a reduced composition without that sidebar simply never runs the callback
 * and the switch is absent rather than blocking the plugin.
 */
const FOOTER_SEAT = 'sidebar.footer.action'

/**
 * Client plugin body.
 *
 * @param ctx - Client Cordis context.
 */
export function apply(ctx: Context): void {
  // 1. Copy and stylesheet. Both are Cordis-held effects, so disabling the
  //    plugin takes its dictionary and its style element with it.
  ctx.effect(() => ctx.locale.register(NS, DICTS), 'dsh-your-turn: locale')
  ctx.effect(() => installStyles(), 'dsh-your-turn: styles')

  // 2. Settings, chimes, and the queue.
  const settings = new SettingsController(ctx)
  ctx.effect(() => () => settings.dispose(), 'dsh-your-turn: settings')

  const sound = new SoundEngine()
  ctx.effect(() => () => sound.dispose(), 'dsh-your-turn: audio')

  const notifier = new Notifier(ctx, settings, sound, () => undefined)
  ctx.effect(() => () => notifier.dispose(), 'dsh-your-turn: notifier')

  // Browsers keep audio suspended until a gesture. Resuming on the first one
  // means a user who has touched the page at all hears the very first reminder;
  // a page nobody has touched stays silent, which is the platform's rule.
  ctx.effect(() => {
    const unlock = (): void => {
      void notifier.unlockAudio()
    }
    window.addEventListener('pointerdown', unlock, { once: true, passive: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, 'dsh-your-turn: audio unlock')

  // 3. Turn watching.
  const watcher = watchTurns(ctx, {
    onTurnEnd: (record) => notifier.consider(record),
  })
  ctx.effect(() => () => watcher.dispose(), 'dsh-your-turn: turn watcher')

  // Optional and late-bound: older/reduced compositions can still remind at turn end.
  ctx.inject(['uiSession' as never], (child) => {
    child.effect(() => watchQuestions(child, (record) => notifier.considerQuestion(record)), 'dsh-your-turn: questions')
  })

  // 4. The reminder surfaces.
  const openSession = createSessionOpener(ctx)
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      { name: 'shell.overlay', id: OVERLAY_ID, order: 40, locale: NS, inject: () => ({ notifier, openSession }) },
      ReminderSurface,
    ),
  )

  // 5. The settings page, when this composition serves the plugin's section.
  const scope = settings.form
  if (scope === undefined) {
    console.warn('[dsh-your-turn] no settings form; the configuration page is unavailable in this composition')
    return
  }
  const model = new ImmediateSettings(scope, FIELD_SPECS)
  ctx.effect(() => () => model.dispose(), 'dsh-your-turn: settings model')
  const view = model.view
  const actions = model.actions
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('settings.section', () =>
    ctx.slots.register(
      {
        name: 'settings.section',
        id: SETTINGS_SECTION_ID,
        order: 60,
        label: () => t('settings.nav'),
        locale: NS,
        inject: () => ({ form: actions, view, notifier }),
      },
      SettingsPage,
    ),
  )

  // 6. The always-available sound switch, in the sidebar foot beside the
  //    remote-control phone. It rides on the settings model's own face, so the
  //    foot switch and the settings row are one state.
  ctx.slots.inject(FOOTER_SEAT, () =>
    ctx.slots.register(
      {
        name: FOOTER_SEAT,
        id: SOUND_TOGGLE_ID,
        order: 10,
        locale: NS,
        inject: () => ({ form: actions, view, notifier }),
      },
      SoundToggle,
    ),
  )
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
function createSessionOpener(ctx: Context): (sessionId: string) => void {
  return (sessionId: string): void => {
    const workspace = ctx.get('uiWorkspace' as never) as
      | { openSession(target: string): void }
      | undefined
    if (workspace === undefined || typeof workspace.openSession !== 'function') {
      console.info(`[dsh-your-turn] session ${sessionId}: this composition has no Workspace navigation`)
      return
    }
    try {
      workspace.openSession(sessionId)
    } catch (error) {
      console.warn('[dsh-your-turn] opening the session failed', error)
    }
  }
}
