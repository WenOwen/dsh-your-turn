/**
 * The always-available sound switch: one icon in the sidebar's foot seat,
 * beside the remote-control phone.
 *
 * It exists because the reminder only appears at the moment a turn ends — the
 * one moment you are least able to go hunting through Settings. It registers
 * into `sidebar.footer.action`, the seat that belongs to
 * `@deepseek-ai/dsh-client-ui-sidebar` and already hosts the remote-web-ui
 * phone trigger, so the sidebar itself lays the geometry out: a 36px circle in
 * the rail, a full-row pill when the column is wide. Copying that seat's
 * conventions (transparent background, `label-secondary`, hover/active tokens,
 * box-shadow focus ring) is what keeps it looking like one family rather than
 * a bolted-on widget, and the glyph is a stroke-only SVG in `currentColor` so
 * it carries no color of its own.
 *
 * It is deliberately NOT a second source of truth: it reads and writes the same
 * `soundEnabled` field through the same {@link ImmediateSettings} face as the
 * settings page, so the two can never disagree, and a remote memory-mode page
 * persists it to the same browser-local settings document. Nothing here mutes
 * the reminder itself — the popup still appears; only the chime stops.
 *
 * @module dsh-your-turn/client/SoundToggle
 */

import type { ReactNode } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ImmediateSettings } from './immediateSettings.ts'
import type { Notifier } from './notifier.ts'
import { NS } from './locale.ts'
import { useSnapshot, type SnapshotSource } from './observable.ts'
import type { SettingsFormView } from './SettingsPage.tsx'
import { resolvePreset } from './sound.ts'

/** Business face injected into the sound switch. */
export interface SoundToggleInjected {
  /** The same field-local write queue the settings page uses. */
  form: ImmediateSettings['actions']
  /** Bound projection of that queue, so both controls show one state. */
  view: SnapshotSource<SettingsFormView>
  /** Used to play the success voice back when sound is turned on. */
  notifier: Notifier
  /** Navigate the Workspace to the given session id; the popup uses the same hook. */
  openSession: (sessionId: string) => void
}

/**
 * Props of the sound switch: the footer seat's column state, the injected face
 * and the localized `t` seat.
 */
export type SoundToggleProps = SoundToggleInjected & {
  /** Whether the sidebar renders wide content (false = 56px rail). */
  wide: boolean
  t: TranslateNS<typeof NS>
}

/** Root marker every surface of this plugin carries. */
const ROOT_ATTR = { 'data-plugin': 'dsh-your-turn' } as const

/**
 * Render the sound switch as the sidebar foot's own row.
 *
 * @param props - seat column state, injected form face, view, notifier and `t`.
 * @returns one footer row, or nothing while the settings form is unavailable.
 */
export function SoundToggle({ t, form, view, notifier, openSession, wide }: SoundToggleProps): ReactNode {
  const state = useSnapshot(view)
  const notifierState = useSnapshot(notifier.state)
  const field = state.fields.soundEnabled
  if (field === undefined) return null

  const on = field.text === 'true'
  const disabled = !state.shell.writable
  const action = t(on ? 'sound.toggle.mute' : 'sound.toggle.unmute')
  const pending = notifierState.reminders
  const pendingCount = pending.length
  const tooltipId = pendingCount > 0 ? 'yt-sound-pending' : undefined
  return (
    <div className="dshYourTurn yt-sound" {...ROOT_ATTR} data-rail={wide ? undefined : 'rail'} data-state={on ? 'on' : 'muted'} data-pending={pendingCount > 0 ? 'true' : undefined}>
      <button
        type="button"
        className="yt-sound__trigger"
        data-wide={wide ? 'wide' : 'rail'}
        aria-pressed={on}
        aria-label={t('sound.toggle.label')}
        aria-describedby={tooltipId}
        title={action}
        disabled={disabled}
        onClick={() => {
          if (disabled) return
          form.edit('soundEnabled', on ? 'false' : 'true')
          // Turning it back on should be audible immediately: the click is also
          // the gesture that unlocks the page's audio, so it doubles as a preview.
          if (!on) notifier.preview(resolvePreset(state.fields.soundPreset?.text))
        }}
      >
        <SpeakerIcon muted={!on} size={wide ? 16 : 18} />
        {pendingCount > 0 ? (
          <span className="yt-sound__badge" aria-hidden="true">{pendingCount > 9 ? '9+' : pendingCount}</span>
        ) : null}
      </button>
      {pendingCount > 0 ? (
        <div id={tooltipId} className="yt-sound__pending" role="tooltip" data-rail={wide ? undefined : 'rail'}>
          <p className="yt-sound__pendingTitle">
            {pendingCount === 1 ? t('sound.pending.one') : t('sound.pending.many', { count: pendingCount })}
          </p>
          <ul className="yt-sound__pendingList">
            {pending.map(reminder => (
              <li key={reminder.id}>
                <button
                  type="button"
                  className="yt-sound__pendingItem"
                  onClick={() => {
                    openSession(reminder.sessionId)
                    notifier.acknowledge(reminder.id)
                  }}
                  title={reminder.cwd ?? reminder.sessionId}
                >
                  <span className="yt-sound__pendingDot" data-outcome={reminder.outcome} aria-hidden="true" />
                  <span className="yt-sound__pendingName">{reminder.title || reminder.sessionId}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/**
 * The speaker glyph, drawn the way the shipped sidebar icons are: a 16-box
 * stroke-only SVG in `currentColor`, no literal color anywhere. The audible
 * state adds two waves; the muted state replaces them with an X.
 *
 * @param props - whether sound is off, and the pixel size the seat asks for.
 * @returns the inline SVG element.
 */
function SpeakerIcon({ muted, size }: { muted: boolean; size: number }): ReactNode {
  return (
    <svg
      className="yt-sound__glyph"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3.2 6.1h1.9l3.3-2.6v9l-3.3-2.6H3.2z" />
      {muted ? (
        <>
          <path d="M10.6 6.4 13.5 9.3" />
          <path d="M13.5 6.4 10.6 9.3" />
        </>
      ) : (
        <>
          <path d="M10.4 6.1a2.7 2.7 0 0 1 0 3.8" />
          <path d="M12.3 4.4a5.2 5.2 0 0 1 0 7.2" />
        </>
      )}
    </svg>
  )
}
