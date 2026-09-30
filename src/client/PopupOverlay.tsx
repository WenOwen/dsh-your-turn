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

import { useState, type ReactNode } from 'react'
import { Button, Modal, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { Notifier } from './notifier.ts'
import { useSnapshot } from './observable.ts'
import { formatDuration, headlineKey } from './presentation.ts'

/** Business face injected into the reminder surfaces. */
export interface ReminderInjected {
  /** The reminder queue and its actions. */
  notifier: Notifier
  /** Select a Session and show its Conversation; a no-op when navigation is absent. */
  openSession: (sessionId: string) => void
}

/** Props of the reminder surfaces: the injected face plus the localized `t` seat. */
export type ReminderProps = ReminderInjected & { t: TranslateNS<'yourTurn'> }

/** Root marker every surface of this plugin carries. */
const ROOT_ATTR = { 'data-plugin': 'dsh-your-turn' } as const

/**
 * Render the configured reminder surfaces for the head of the queue.
 *
 * @param props - injected actions and the localized translate seat.
 * @returns the popup, the banner, both, or nothing.
 */
export function ReminderSurface({ t, notifier, openSession }: ReminderProps): ReactNode {
  const state = useSnapshot(notifier.state)
  const settings = useSnapshot(notifier.settingsSnapshot)
  // With both surfaces configured, the banner is a first cue and finishes on its
  // own; the popup stays until it is dismissed. Keyed by reminder id so the next
  // one gets its own banner.
  const [bannerSpentFor, setBannerSpentFor] = useState<string | undefined>(undefined)

  const head = state.reminders[0]
  if (head === undefined) return null

  const surface = settings.config.surface
  const showModal = surface === 'modal' || surface === 'both'
  const showBanner = (surface === 'toast' || surface === 'both') && bannerSpentFor !== head.id
  const queued = state.reminders.length - 1

  const dismiss = (): void => notifier.dismiss(head.id)
  const jump = (): void => {
    openSession(head.sessionId)
    dismiss()
  }

  const body = (
    <div className="dshYourTurn yt-reminder" {...ROOT_ATTR}>
      <p className="yt-reminder__status">
        <span className="yt-reminder__dot" data-outcome={head.outcome} aria-hidden="true" />
        <span>
          {t(headlineKey(head.outcome))}
          {head.turn === undefined ? '' : ` · ${t('meta.turn', { turn: head.turn })}`}
        </span>
      </p>
      <div className="yt-reminder__session">
        <h3 className="yt-reminder__title">{head.title === '' ? t('untitledSession') : head.title}</h3>
        {head.cwd === undefined ? null : <p className="yt-reminder__path">{head.cwd}</p>}
        <ul className="yt-reminder__meta">
          <li>{t('meta.duration', { duration: formatDuration(t, head.durationMs) })}</li>
        </ul>
      </div>
      {queued > 0 ? <p className="yt-reminder__queued">{t('meta.queued', { count: queued })}</p> : null}
    </div>
  )

  const actions = (
    <div className="dshYourTurn yt-reminder__actions" {...ROOT_ATTR}>
      <Button variant="ghost" size="sm" onClick={() => notifier.muteSession(head.sessionId)}>
        {t('action.mute')}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => notifier.snooze(head.id)}>
        {t('action.snooze')}
      </Button>
      <Button variant="outline" size="sm" onClick={dismiss}>
        {t('action.dismiss')}
      </Button>
      <Button variant="primary" size="sm" onClick={jump}>
        {t('action.jump')}
      </Button>
    </div>
  )

  return (
    <>
      {showBanner ? (
        <Toast
          key={head.id}
          text={t('toast.text', { title: t('title'), headline: t(headlineKey(head.outcome)) })}
          holdMs={bannerHoldMs(settings.config.autoDismissSeconds)}
          actions={[{ label: t('toast.jump'), onClick: jump }]}
          onDone={() => {
            if (showModal) setBannerSpentFor(head.id)
            else dismiss()
          }}
        />
      ) : null}
      {showModal ? (
        <Modal
          open
          onClose={dismiss}
          title={t('title')}
          closeLabel={t('close')}
          footer={actions}
        >
          {body}
        </Modal>
      ) : null}
    </>
  )
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
function bannerHoldMs(autoDismissSeconds: number): number {
  if (autoDismissSeconds <= 0) return 8000
  return Math.max(3000, Math.min(autoDismissSeconds * 1000, 8000))
}
