/**
 * The plugin's settings page (`settings.section`).
 *
 * The frame, the staging model, and the save path are the shipped ones —
 * `SettingsForm` owns the unavailable / read-only / save-failed chrome and
 * `SettingsFormModel` owns "drafts are staged, only Save writes, a refused save
 * keeps the draft". What this module adds is the controls: switches, bounded
 * number inputs, clock inputs, and chip rows, which the text-only stock field
 * cannot express.
 *
 * @module dsh-your-turn/client/SettingsPage
 */

import type { ReactNode } from 'react'
import {
  Button,
  Input,
  Pill,
  SettingsForm,
  Switch,
  Tag,
  type SettingsFieldState,
  type SettingsFormActions,
  type SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { SoundPreset } from '../shared/settings.ts'
import { ALL_FIELDS, GROUPS, type RowDescriptor } from './formSpecs.ts'
import { NS } from './locale.ts'
import type { Notifier } from './notifier.ts'
import { useSnapshot, type SnapshotSource } from './observable.ts'
import { resolvePreset } from './sound.ts'

/** The projection the page's bound store publishes. */
export interface SettingsFormView {
  /** Frame state: availability, writability, dirtiness, save progress. */
  shell: SettingsFormShell
  /** Per-field draft text, override state, and validity. */
  fields: Readonly<Record<string, SettingsFieldState>>
}

/** Business face injected into the settings page. */
export interface SettingsPageInjected {
  /** Staged-edit actions from the shared form model. */
  form: SettingsFormActions
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
  const queue = useSnapshot(notifier.state)
  const disabled = !state.shell.writable
  const audioBlocked = !queue.audioUnlocked

  return (
    <SettingsForm
      labels={{
        unavailable: t('settings.unavailable'),
        readOnly: t('settings.readOnly'),
        saveFailed: t('settings.saveFailed'),
        save: t('settings.save'),
        saving: t('settings.saving'),
      }}
      state={state.shell}
      onSave={form.save}
      onDiscard={form.discard}
    >
      <div className="dshYourTurn yt-settings" data-plugin="dsh-your-turn">
        <p className="yt-settings__intro">{t('settings.intro')}</p>
        {GROUPS.map((group) => (
          <section className="yt-settings__group" key={group.titleKey}>
            <h3 className="yt-settings__groupTitle">{t(group.titleKey)}</h3>
            {group.rows.map((row) => (
              <Row
                key={row.field}
                t={t}
                row={row}
                state={state.fields[row.field]}
                disabled={disabled}
                onEdit={form.edit}
                onReset={form.resetField}
                onPreview={() => notifier.preview(resolvePreset(soundPresetOf(state, row.field)))}
                previewBlocked={row.trailing === 'preview' && audioBlocked}
              />
            ))}
          </section>
        ))}
        <div className="yt-settings__actions">
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            title={t('settings.resetAllHint')}
            onClick={() => {
              for (const field of ALL_FIELDS) form.resetField(field)
            }}
          >
            {t('settings.resetAll')}
          </Button>
          <span className="yt-settings__footer">{t('settings.resetAllHint')}</span>
        </div>
        <p className="yt-settings__footer">{t('settings.footer')}</p>
      </div>
    </SettingsForm>
  )
}

/** Read the staged/draft sound preset for the Preview action. */
function soundPresetOf(state: SettingsFormView, field: string): SoundPreset {
  const text = state.fields[field]?.text
  return resolvePreset(text === undefined || text === '' ? undefined : text)
}

/** One labelled row. */
function Row({
  t,
  row,
  state,
  disabled,
  onEdit,
  onReset,
  onPreview,
  previewBlocked,
}: {
  t: TranslateNS<typeof NS>
  row: RowDescriptor
  state: SettingsFieldState | undefined
  disabled: boolean
  onEdit: (field: string, text: string) => void
  onReset: (field: string) => void
  onPreview: () => void
  previewBlocked: boolean
}): ReactNode {
  const draft = state ?? { text: '', overridden: false, invalid: false }
  const label = t(row.labelKey)
  const id = `yt-field-${row.field}`
  return (
    <div className="yt-row">
      <div className="yt-row__label">
        <label htmlFor={id}>{label}</label>
        <p className="yt-row__hint" data-invalid={draft.invalid ? 'true' : 'false'}>
          {draft.invalid ? t('settings.invalid') : t(row.hintKey)}
        </p>
      </div>
      <div className="yt-row__control">
        {control({ t, row, id, draft, disabled, onEdit, onPreview, previewBlocked })}
      </div>
      {draft.overridden ? (
        <div className="yt-row__badges">
          <Tag tone="quiet">{t('settings.overridden')}</Tag>
          <button type="button" className="yt-row__reset" disabled={disabled} onClick={() => onReset(row.field)}>
            {t('settings.reset')}
          </button>
        </div>
      ) : null}
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
  previewBlocked,
}: {
  t: TranslateNS<typeof NS>
  row: RowDescriptor
  id: string
  draft: SettingsFieldState
  disabled: boolean
  onEdit: (field: string, text: string) => void
  onPreview: () => void
  previewBlocked: boolean
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
    case 'clock':
      return (
        <Input
          id={id}
          className="yt-row__text"
          inputMode="numeric"
          value={draft.text}
          placeholder="HH:MM"
          disabled={disabled}
          aria-label={label}
          aria-invalid={draft.invalid}
          onChange={(event) => onEdit(row.field, event.target.value)}
        />
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
                disabled={disabled}
                onClick={() => {
                  if (!disabled) onEdit(row.field, option.value)
                }}
              >
                {t(option.labelKey)}
              </Pill>
            ))}
          </div>
          {row.trailing === 'preview' ? (
            <Button
              variant="outline"
              size="sm"
              title={t('settings.previewHint')}
              onClick={onPreview}
            >
              {t('settings.preview')}
            </Button>
          ) : null}
          {previewBlocked ? <p className="yt-row__note">{t('settings.previewBlocked')}</p> : null}
        </>
      )
    default:
      return null
  }
}
