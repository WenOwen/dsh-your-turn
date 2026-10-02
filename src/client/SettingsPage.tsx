/**
 * The plugin's settings page (`settings.section`).
 *
 * Field formatting and validity use the official model. A field-local write
 * queue applies valid changes automatically; this page intentionally has no Save
 * button and shows only availability, automatic-write progress and failures.
 *
 * @module dsh-your-turn/client/SettingsPage
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Input,
  Pill,
  Switch,
  type SettingsFieldState,
  type SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SoundPreset } from '../shared/settings.ts'
import { GROUPS, type RowDescriptor } from './formSpecs.ts'
import type { ImmediateSettings } from './immediateSettings.ts'
import { NS } from './locale.ts'
import type { Notifier } from './notifier.ts'
import { useSnapshot, type SnapshotSource } from './observable.ts'
import { resolvePreset } from './sound.ts'

/** The projection the page's bound store publishes. */
export interface SettingsFormView {
  /** Frame state: availability, writability, dirtiness, save progress. */
  shell: SettingsFormShell
  /** Monotonic count of confirmed successful writes, not optimistic UI edits. */
  savedVersion?: number
  /** Per-field draft text, override state, and validity. */
  fields: Readonly<Record<string, SettingsFieldState>>
}

/** Business face injected into the settings page. */
export interface SettingsPageInjected {
  /** Field-local edits are applied automatically. */
  form: ImmediateSettings['actions']
  /** Bound projection of the form model. */
  view: SnapshotSource<SettingsFormView>
  /** The reminder queue, for the audio Preview action. */
  notifier: Notifier
}

/** Props of the settings page. */
export type SettingsPageProps = SettingsPageInjected & { t: TranslateNS<typeof NS> }

/**
 * Render the settings page.
 *
 * @param props - injected form actions and the localized translate seat.
 * @returns the settings section content.
 */
export function SettingsPage({ t, form, view, notifier }: SettingsPageProps): ReactNode {
  const state = useSnapshot(view)
  const disabled = !state.shell.writable

  if (!state.shell.available) return <p role="status">{t('settings.unavailable')}</p>
  return (
    <div>
      {disabled && <p role="status">{t('settings.readOnly')}</p>}
      <div className="dshYourTurn yt-settings" data-plugin="dsh-your-turn">
        {GROUPS.map((group) => (
          <section className="yt-settings__group" key={group.id}>
            {group.titleKey !== undefined && <h3 className="yt-settings__groupTitle">{t(group.titleKey)}</h3>}
            {group.rows.map((row) => (
              <Row
                key={row.field}
                t={t}
                row={row}
                state={state.fields[row.field]}
                disabled={disabled}
                onEdit={form.edit}
                onPreview={(preset) => notifier.preview(preset)}
              />
            ))}
          </section>
        ))}
        <SaveFeedback state={state} t={t} />
      </div>
    </div>
  )
}

/** Fixed-space feedback: acknowledge only committed writes and never move the controls. */
function SaveFeedback({ state, t }: { state: SettingsFormView; t: TranslateNS<typeof NS> }): ReactNode {
  const version = state.savedVersion ?? 0
  const seenVersion = useRef(version)
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    if (state.shell.saving || state.shell.failed || state.shell.dirty) {
      setSaved(false)
      return
    }
    if (version === seenVersion.current) return
    seenVersion.current = version
    setSaved(true)
    const timer = window.setTimeout(() => setSaved(false), 2500)
    return () => window.clearTimeout(timer)
  }, [version, state.shell.saving, state.shell.failed, state.shell.dirty])
  const visible = state.shell.failed || saved
  return (
    <div className="yt-settings__feedback" role="status" aria-live="polite" aria-atomic="true">
      <span className="yt-settings__feedbackText" data-visible={visible ? 'true' : 'false'} data-error={state.shell.failed ? 'true' : 'false'} aria-hidden={!visible}>
        {state.shell.failed ? t('settings.saveFailed') : version > 0 ? t('settings.saved') : ''}
      </span>
    </div>
  )
}

/** One labelled row. */
function Row({
  t,
  row,
  state,
  disabled,
  onEdit,
  onPreview,
}: {
  t: TranslateNS<typeof NS>
  row: RowDescriptor
  state: SettingsFieldState | undefined
  disabled: boolean
  onEdit: (field: string, text: string) => void
  onPreview: (preset: SoundPreset) => void
}): ReactNode {
  const draft = state ?? { text: '', overridden: false, invalid: false }
  const label = t(row.labelKey)
  const id = `yt-field-${row.field}`
  return (
    <div className="yt-row">
      <div className="yt-row__label">
        <label htmlFor={id}>{label}</label>
        {draft.invalid && (
          <p className="yt-row__hint" data-invalid="true" role="status">{t('settings.invalid')}</p>
        )}
      </div>
      <div className="yt-row__control">
        {control({ t, row, id, draft, disabled, onEdit, onPreview })}
      </div>
    </div>
  )
}

/** Draw the control one row declares. */
function control({
  t,
  row,
  id,
  draft,
  disabled,
  onEdit,
  onPreview,
}: {
  t: TranslateNS<typeof NS>
  row: RowDescriptor
  id: string
  draft: SettingsFieldState
  disabled: boolean
  onEdit: (field: string, text: string) => void
  onPreview: (preset: SoundPreset) => void
}): ReactNode {
  const label = t(row.labelKey)
  switch (row.control.kind) {
    case 'switch':
      return (
        <Switch
          checked={draft.text === 'true'}
          label={label}
          disabled={disabled}
          onChange={(next) => onEdit(row.field, next ? 'true' : 'false')}
        />
      )
    case 'number':
      return (
        <Input
          id={id}
          className="yt-row__input"
          inputMode="numeric"
          value={draft.text}
          placeholder={row.control.placeholder}
          disabled={disabled}
          aria-label={label}
          aria-invalid={draft.invalid}
          onChange={(event) => onEdit(row.field, event.target.value)}
        />
      )
    case 'range':
      return (
        <div className="yt-row__slider">
          <input
            id={id}
            className="yt-row__range"
            type="range"
            min={row.control.min}
            max={row.control.max}
            step={row.control.step}
            value={draft.text}
            disabled={disabled}
            aria-label={label}
            aria-invalid={draft.invalid}
            aria-valuetext={`${draft.text}%`}
            onChange={(event) => onEdit(row.field, event.target.value)}
          />
          <output className="yt-row__rangeValue" htmlFor={id}>{draft.text}%</output>
        </div>
      )
    case 'chips':
      return (
        <>
          <div className="yt-row__chips" role="group" aria-label={label} id={id}>
            {row.control.optionKeys.map((option) => (
              <Pill
                key={option.value}
                className="yt-row__chip"
                active={draft.text === option.value}
                aria-pressed={draft.text === option.value}
                disabled={disabled}
                onClick={() => {
                  if (disabled) return
                  onEdit(row.field, option.value)
                  if (row.field === 'soundPreset' || row.field === 'errorSoundPreset') {
                    onPreview(resolvePreset(option.value))
                  }
                }}
              >
                {t(option.labelKey)}
              </Pill>
            ))}
          </div>
        </>
      )
    default:
      return null
  }
}
