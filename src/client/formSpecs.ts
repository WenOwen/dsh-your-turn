/** Settings controls and their field conversions. */
import type { SettingsFieldSpec } from '@deepseek-ai/dsh-client-ui-primitives'
import { LIMITS, SOUND_PRESETS, SURFACES } from '../shared/settings.ts'
import type { YourTurnKey } from './locale.ts'
import { boolField, enumField, intField } from './fieldSpecs.ts'

export type RowControl =
  | { readonly kind: 'switch' }
  | { readonly kind: 'number'; readonly placeholder?: string }
  | { readonly kind: 'range'; readonly min: number; readonly max: number; readonly step: number }
  | { readonly kind: 'chips'; readonly optionKeys: readonly { readonly value: string; readonly labelKey: YourTurnKey }[] }

export interface RowDescriptor {
  readonly field: string
  readonly labelKey: YourTurnKey
  readonly control: RowControl
}
export interface GroupDescriptor {
  readonly id: string
  readonly titleKey?: YourTurnKey
  readonly rows: readonly RowDescriptor[]
}
const SURFACE_LABELS = SURFACES.map(value => ({ value, labelKey: `option.surface.${value}` as YourTurnKey }))
const SOUND_LABELS = SOUND_PRESETS.map(value => ({ value, labelKey: `option.sound.${value}` as YourTurnKey }))

export const FIELD_SPECS: readonly SettingsFieldSpec[] = [
  enumField('surface', SURFACES),
  boolField('soundEnabled'),
  enumField('soundPreset', SOUND_PRESETS),
  enumField('errorSoundPreset', SOUND_PRESETS),
  intField('volume', LIMITS.volume.min, LIMITS.volume.max),
  boolField('onlyWhenUnfocused'),
  boolField('systemNotification'),
  boolField('flashTitle'),
]

export const GROUPS: readonly GroupDescriptor[] = [
  {
    id: 'behaviour', rows: [
      { field: 'onlyWhenUnfocused', labelKey: 'field.onlyWhenUnfocused.label', control: { kind: 'chips', optionKeys: [
        { value: 'true', labelKey: 'option.attention.background' },
        { value: 'false', labelKey: 'option.attention.always' },
      ] } },
    ],
  },
  {
    id: 'surface', rows: [
      { field: 'surface', labelKey: 'field.surface.label', control: { kind: 'chips', optionKeys: SURFACE_LABELS } },
      { field: 'flashTitle', labelKey: 'field.flashTitle.label', control: { kind: 'switch' } },
      { field: 'systemNotification', labelKey: 'field.systemNotification.label', control: { kind: 'switch' } },
    ],
  },
  {
    id: 'sound', titleKey: 'settings.section.sound', rows: [
      { field: 'soundEnabled', labelKey: 'field.soundEnabled.label', control: { kind: 'switch' } },
      { field: 'soundPreset', labelKey: 'field.soundPreset.label', control: { kind: 'chips', optionKeys: SOUND_LABELS } },
      { field: 'errorSoundPreset', labelKey: 'field.errorSoundPreset.label', control: { kind: 'chips', optionKeys: SOUND_LABELS } },
      { field: 'volume', labelKey: 'field.volume.label', control: { kind: 'range', min: LIMITS.volume.min, max: LIMITS.volume.max, step: 1 } },
    ],
  },
]
export const ALL_FIELDS: readonly string[] = GROUPS.flatMap(group => group.rows.map(row => row.field))
