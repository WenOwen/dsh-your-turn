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
 * ## The unread list
 *
 * The list of unread reminders is a popover, not a tooltip: it holds buttons,
 * so it is a `role="dialog"` that opens on hover, can be entered with the
 * pointer, can be pinned, and closes on Escape or on a click outside.
 *
 * The panel used to be a pure-CSS `:hover` reveal anchored 8px above the
 * speaker. That gap was a dead zone: the pointer had to cross it to reach the
 * list, the crossing ended the hover, the panel faded out and took its pointer
 * events with it, so the list could never be reached at all. The only way to
 * keep it on screen was to click the speaker — which is the mute switch, so
 * reading your reminders meant muting the chime.
 *
 * Three things fix that, and they are the whole interaction:
 *
 * - the pointer may now travel from the speaker into the panel, because an
 *   invisible hover bridge fills the gap and the panel's own hit area reaches
 *   the speaker;
 * - the panel is pinned by its own button, so it can stay up without touching
 *   the mute switch;
 * - Escape, a click outside, or unpinning closes it again.
 *
 * @module dsh-your-turn/client/SoundToggle
 */

import { useCallback, useEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from 'react'
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

/** Id of the unread panel, referenced by the trigger's `aria-controls`. */
const PANEL_ID = 'yt-sound-pending'

/** Id of the panel's heading, referenced by the panel's `aria-labelledby`. */
const PANEL_TITLE_ID = 'yt-sound-pending-title'

/**
 * How long the panel stays open after the pointer leaves it.
 *
 * Without this grace period a diagonal move out of the switch would close the
 * panel in the same frame the pointer entered it, which reads as a flicker.
 */
const HOVER_GRACE_MS = 140

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

  // ── The unread panel's own state ─────────────────────────────────────────
  // Every hook runs before the early return below, so the component never
  // changes its hook order while the settings form is still loading.
  const [hovering, setHovering] = useState(false)
  const [focused, setFocused] = useState(false)
  const [pinned, setPinned] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const closeTimer = useRef<number | undefined>(undefined)

  const pending = notifierState.reminders
  const pendingCount = pending.length

  const cancelClose = useCallback((): void => {
    if (closeTimer.current === undefined) return
    window.clearTimeout(closeTimer.current)
    closeTimer.current = undefined
  }, [])

  /**
   * The pointer entered the switch (the speaker or the panel). The panel opens
   * at once; a pending close is cancelled so the two never race.
   */
  const handlePointerOver = useCallback((): void => {
    cancelClose()
    setHovering(true)
  }, [cancelClose])

  /**
   * The pointer left the switch. A move *within* the switch — from the speaker
   * into the panel, or between two entries of the list — is not a departure:
   * `relatedTarget` still sits inside the switch, so the panel stays up.
   */
  const handlePointerOut = useCallback((event: PointerEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget as Node | null
    if (next !== null && event.currentTarget.contains(next)) return
    cancelClose()
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = undefined
      setHovering(false)
    }, HOVER_GRACE_MS)
  }, [cancelClose])

  /** Focus entered the switch: the keyboard gets the same list the mouse does. */
  const handleFocus = useCallback((event: FocusEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget as Node | null
    if (next !== null && event.currentTarget.contains(next)) return
    setFocused(true)
  }, [])

  /** Focus left the switch; the panel closes unless it is pinned. */
  const handleBlur = useCallback((event: FocusEvent<HTMLDivElement>): void => {
    const next = event.relatedTarget as Node | null
    if (next !== null && event.currentTarget.contains(next)) return
    setFocused(false)
  }, [])

  // Drop the timer when the switch goes away, so a pending close cannot fire
  // into an unmounted component.
  useEffect(() => () => {
    if (closeTimer.current !== undefined) window.clearTimeout(closeTimer.current)
  }, [])

  // An empty list has nothing to pin.
  useEffect(() => {
    if (pendingCount === 0) setPinned(false)
  }, [pendingCount])

  // While the panel is pinned it survives the pointer leaving and the focus
  // moving away; a click outside or Escape unpins it.
  useEffect(() => {
    if (!pinned) return
    const onPointerDown = (event: Event): void => {
      const root = rootRef.current
      if (root === null) return
      const target = event.target as Node | null
      if (target !== null && root.contains(target)) return
      setPinned(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      setPinned(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [pinned])

  if (field === undefined) return null

  const on = field.text === 'true'
  const disabled = !state.shell.writable
  const action = t(on ? 'sound.toggle.mute' : 'sound.toggle.unmute')
  const open = pendingCount > 0 && (hovering || focused || pinned)

  return (
    <div
      ref={rootRef}
      className="dshYourTurn yt-sound"
      {...ROOT_ATTR}
      data-rail={wide ? undefined : 'rail'}
      data-state={on ? 'on' : 'muted'}
      data-pending={pendingCount > 0 ? 'true' : undefined}
      data-open={open ? 'true' : undefined}
      data-pinned={pinned ? 'true' : undefined}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <button
        type="button"
        className="yt-sound__trigger"
        data-wide={wide ? 'wide' : 'rail'}
        aria-pressed={on}
        aria-label={t('sound.toggle.label')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={pendingCount > 0 ? PANEL_ID : undefined}
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
        <div
          id={PANEL_ID}
          className="yt-sound__pending"
          role="dialog"
          aria-modal="false"
          aria-labelledby={PANEL_TITLE_ID}
          data-rail={wide ? undefined : 'rail'}
        >
          <div className="yt-sound__pendingHead">
            <p id={PANEL_TITLE_ID} className="yt-sound__pendingTitle">
              {pendingCount === 1 ? t('sound.pending.one') : t('sound.pending.many', { count: pendingCount })}
            </p>
            <button
              type="button"
              className="yt-sound__pin"
              aria-pressed={pinned}
              aria-label={t(pinned ? 'sound.pending.unpin' : 'sound.pending.pin')}
              title={t(pinned ? 'sound.pending.unpin' : 'sound.pending.pin')}
              onClick={() => setPinned(value => !value)}
            >
              <PinIcon />
            </button>
          </div>
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

/**
 * The pin glyph: a push-pin head with its stem, stroke-only like the speaker.
 *
 * @returns the inline SVG element.
 */
function PinIcon(): ReactNode {
  return (
    <svg
      className="yt-sound__pinGlyph"
      width={14}
      height={14}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9.9 2.6a2.2 2.2 0 1 0-3.8 0c0 .9.5 1.7 1.3 2l-.4 3h2l-.4-3c.8-.3 1.3-1.1 1.3-2z" />
      <path d="M8 7.6v5.8" />
    </svg>
  )
}
