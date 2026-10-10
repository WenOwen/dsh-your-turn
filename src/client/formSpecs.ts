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
  | { readonly kind: 'select'; readonly optionKeys: readonly { readonly value: string; readonly labelKey: YourTurnKey }[]; readonly customLabelKey: YourTurnKey; readonly customMin: number; readonly customMax: number }

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

/**
 * Preset seconds for the auto-dismiss control. Zero is "never"; every other
 * value is shown in the dropdown with a localised label. The number field that
 * appears under "Custom…" is bounded by the same `LIMITS.autoDismissSeconds`
 * cap, so users can enter any value 0-600 even when none of the presets fit.
 */
export const DISMISS_PRESETS: readonly number[] = [0, 5, 10, 30, 60, 120, 300]
const DISMISS_PRESET_LABELS: Readonly<Record<number, YourTurnKey>> = {
  0: 'option.dismiss.never',
  5: 'option.dismiss.5s',
  10: 'option.dismiss.10s',
  30: 'option.dismiss.30s',
  60: 'option.dismiss.1m',
  120: 'option.dismiss.2m',
  300: 'option.dismiss.5m',
}
const DISMISS_OPTION_KEYS = [
  ...DISMISS_PRESETS.map(value => ({ value: String(value), labelKey: DISMISS_PRESET_LABELS[value]! })),
  { value: 'custom', labelKey: 'option.dismiss.custom' as YourTurnKey },
]

export const FIELD_SPECS: readonly SettingsFieldSpec[] = [
  enumField('surface', SURFACES),
  intField('autoDismissSeconds', LIMITS.autoDismissSeconds.min, LIMITS.autoDismissSeconds.max),
  boolField('soundEnabled'),
  enumField('soundPreset', SOUND_PRESETS),
  enumField('errorSoundPreset', SOUND_PRESETS),
  intField('volume', LIMITS.volume.min, LIMITS.volume.max),
]

export const GROUPS: readonly GroupDescriptor[] = [
  {
    id: 'surface', rows: [
      { field: 'surface', labelKey: 'field.surface.label', control: { kind: 'chips', optionKeys: SURFACE_LABELS } },
      { field: 'autoDismissSeconds', labelKey: 'field.autoDismissSeconds.label', control: {
        kind: 'select', optionKeys: DISMISS_OPTION_KEYS, customLabelKey: 'option.dismiss.customValue',
        customMin: LIMITS.autoDismissSeconds.min, customMax: LIMITS.autoDismissSeconds.max,
      } },
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

/** The select's "custom" sentinel; the value is stored as a plain integer string. */
export const DISMISS_CUSTOM = 'custom'
