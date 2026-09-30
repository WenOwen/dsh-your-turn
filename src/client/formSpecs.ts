/**
 * The settings page's shape: which fields exist, how each is staged, and how the
 * rows are grouped.
 *
 * The staging specs and the layout table live together so a field cannot be
 * rendered without a conversion, and adding a setting is one edit in one file.
 *
 * @module dsh-your-turn/client/formSpecs
 */

import type { SettingsFieldSpec } from '@deepseek-ai/dsh-client-ui-primitives'
import { LIMITS, NOTIFY_ON, SOUND_PRESETS, SURFACES } from '../shared/settings.ts'
import type { YourTurnKey } from './locale.ts'
import { boolField, clockField, enumField, intField } from './fieldSpecs.ts'

/** How one row is edited. */
export type RowControl =
  | { readonly kind: 'switch' }
  | { readonly kind: 'number'; readonly placeholder?: string }
  | { readonly kind: 'clock' }
  | { readonly kind: 'chips'; readonly optionKeys: readonly { readonly value: string; readonly labelKey: YourTurnKey }[] }

/** One settings row. */
export interface RowDescriptor {
  /** Field name inside the settings section; also the staging spec's key. */
  readonly field: string
  /** Dictionary key of the visible label. */
  readonly labelKey: YourTurnKey
  /** Dictionary key of the one-line explanation. */
  readonly hintKey: YourTurnKey
  /** Control the row draws. */
  readonly control: RowControl
  /** Optional trailing action next to the control. */
  readonly trailing?: 'preview'
}

/** One titled group of rows. */
export interface GroupDescriptor {
  /** Dictionary key of the group heading. */
  readonly titleKey: YourTurnKey
  /** Rows, in display order. */
  readonly rows: readonly RowDescriptor[]
}

/** Dictionary keys for the closed vocabularies the chips render. */
const SURFACE_LABELS: readonly { value: string; labelKey: YourTurnKey }[] = [
  { value: 'modal', labelKey: 'option.surface.modal' },
  { value: 'toast', labelKey: 'option.surface.toast' },
  { value: 'both', labelKey: 'option.surface.both' },
]

const SOUND_LABELS: readonly { value: string; labelKey: YourTurnKey }[] = [
  { value: 'chime', labelKey: 'option.sound.chime' },
  { value: 'ping', labelKey: 'option.sound.ping' },
  { value: 'marimba', labelKey: 'option.sound.marimba' },
  { value: 'arcade', labelKey: 'option.sound.arcade' },
  { value: 'drop', labelKey: 'option.sound.drop' },
  { value: 'alert', labelKey: 'option.sound.alert' },
  { value: 'none', labelKey: 'option.sound.none' },
]

const NOTIFY_LABELS: readonly { value: string; labelKey: YourTurnKey }[] = [
  { value: 'success', labelKey: 'option.notifyOn.success' },
  { value: 'success-and-failure', labelKey: 'option.notifyOn.success-and-failure' },
  { value: 'all', labelKey: 'option.notifyOn.all' },
]

/** Staging conversions, in the same order as the layout below. */
export const FIELD_SPECS: readonly SettingsFieldSpec[] = [
  boolField('enabled'),
  enumField('surface', SURFACES),
  intField('autoDismissSeconds', LIMITS.autoDismissSeconds.min, LIMITS.autoDismissSeconds.max),
  boolField('soundEnabled'),
  enumField('soundPreset', SOUND_PRESETS),
  enumField('errorSoundPreset', SOUND_PRESETS),
  intField('volume', LIMITS.volume.min, LIMITS.volume.max),
  boolField('onlyWhenUnfocused'),
  intField('minTurnSeconds', LIMITS.minTurnSeconds.min, LIMITS.minTurnSeconds.max),
  boolField('includeSubagents'),
  enumField('notifyOn', NOTIFY_ON),
  boolField('systemNotification'),
  boolField('flashTitle'),
  boolField('quietHoursEnabled'),
  clockField('quietHoursStart'),
  clockField('quietHoursEnd'),
  boolField('muteAll'),
]

/** The page's groups and rows. */
export const GROUPS: readonly GroupDescriptor[] = [
  {
    titleKey: 'settings.section.behaviour',
    rows: [
      { field: 'enabled', labelKey: 'field.enabled.label', hintKey: 'field.enabled.hint', control: { kind: 'switch' } },
      {
        field: 'onlyWhenUnfocused',
        labelKey: 'field.onlyWhenUnfocused.label',
        hintKey: 'field.onlyWhenUnfocused.hint',
        control: { kind: 'switch' },
      },
      {
        field: 'minTurnSeconds',
        labelKey: 'field.minTurnSeconds.label',
        hintKey: 'field.minTurnSeconds.hint',
        control: { kind: 'number', placeholder: '0' },
      },
      {
        field: 'notifyOn',
        labelKey: 'field.notifyOn.label',
        hintKey: 'field.notifyOn.hint',
        control: { kind: 'chips', optionKeys: NOTIFY_LABELS },
      },
      {
        field: 'includeSubagents',
        labelKey: 'field.includeSubagents.label',
        hintKey: 'field.includeSubagents.hint',
        control: { kind: 'switch' },
      },
    ],
  },
  {
    titleKey: 'settings.section.surface',
    rows: [
      {
        field: 'surface',
        labelKey: 'field.surface.label',
        hintKey: 'field.surface.hint',
        control: { kind: 'chips', optionKeys: SURFACE_LABELS },
      },
      {
        field: 'autoDismissSeconds',
        labelKey: 'field.autoDismissSeconds.label',
        hintKey: 'field.autoDismissSeconds.hint',
        control: { kind: 'number', placeholder: '0' },
      },
      { field: 'flashTitle', labelKey: 'field.flashTitle.label', hintKey: 'field.flashTitle.hint', control: { kind: 'switch' } },
      {
        field: 'systemNotification',
        labelKey: 'field.systemNotification.label',
        hintKey: 'field.systemNotification.hint',
        control: { kind: 'switch' },
      },
    ],
  },
  {
    titleKey: 'settings.section.sound',
    rows: [
      {
        field: 'soundEnabled',
        labelKey: 'field.soundEnabled.label',
        hintKey: 'field.soundEnabled.hint',
        control: { kind: 'switch' },
      },
      {
        field: 'soundPreset',
        labelKey: 'field.soundPreset.label',
        hintKey: 'field.soundPreset.hint',
        control: { kind: 'chips', optionKeys: SOUND_LABELS },
        trailing: 'preview',
      },
      {
        field: 'errorSoundPreset',
        labelKey: 'field.errorSoundPreset.label',
        hintKey: 'field.errorSoundPreset.hint',
        control: { kind: 'chips', optionKeys: SOUND_LABELS },
      },
      {
        field: 'volume',
        labelKey: 'field.volume.label',
        hintKey: 'field.volume.hint',
        control: { kind: 'number', placeholder: '70' },
      },
    ],
  },
  {
    titleKey: 'settings.section.scope',
    rows: [
      {
        field: 'quietHoursEnabled',
        labelKey: 'field.quietHoursEnabled.label',
        hintKey: 'field.quietHoursEnabled.hint',
        control: { kind: 'switch' },
      },
      {
        field: 'quietHoursStart',
        labelKey: 'field.quietHoursStart.label',
        hintKey: 'field.quietHoursStart.hint',
        control: { kind: 'clock' },
      },
      {
        field: 'quietHoursEnd',
        labelKey: 'field.quietHoursEnd.label',
        hintKey: 'field.quietHoursEnd.hint',
        control: { kind: 'clock' },
      },
      { field: 'muteAll', labelKey: 'field.muteAll.label', hintKey: 'field.muteAll.hint', control: { kind: 'switch' } },
    ],
  },
]

/** Every field the page owns, in layout order. */
export const ALL_FIELDS: readonly string[] = GROUPS.flatMap((group) => group.rows.map((row) => row.field))
