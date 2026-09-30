/**
 * Draft-text conversions for this plugin's settings fields.
 *
 * The shared form model stages what the user typed and writes only on save, so
 * every control needs a pair of pure functions: render a stored value as text,
 * and turn text back into the write it stages — or refuse it. Refusing (rather
 * than guessing) is what makes an out-of-range number block the save instead of
 * silently becoming something else.
 *
 * @module dsh-your-turn/client/fieldSpecs
 */

import type { SettingsFieldSpec, SettingsFieldWrite } from '@deepseek-ai/dsh-client-ui-primitives'

/** An empty draft, which the form turns into a clear (revert to the default). */
const CLEAR: SettingsFieldWrite = { kind: 'clear' }

/**
 * A boolean field, edited by a switch.
 * @param field - field name inside the settings section.
 * @returns the conversion spec.
 */
export function boolField(field: string): SettingsFieldSpec {
  return {
    field,
    format: (value) => (value === true ? 'true' : value === false ? 'false' : ''),
    parse: (text) => {
      const normalized = text.trim().toLowerCase()
      if (normalized === '') return CLEAR
      if (normalized === 'true' || normalized === '1' || normalized === 'on' || normalized === 'yes') {
        return { kind: 'set', value: true }
      }
      if (normalized === 'false' || normalized === '0' || normalized === 'off' || normalized === 'no') {
        return { kind: 'set', value: false }
      }
      return undefined
    },
  }
}

/**
 * An integer field with hard bounds matching the Host schema.
 * @param field - field name inside the settings section.
 * @param min - smallest accepted value.
 * @param max - largest accepted value.
 * @returns the conversion spec.
 */
export function intField(field: string, min: number, max: number): SettingsFieldSpec {
  return {
    field,
    format: (value) => (typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value)) : ''),
    parse: (text) => {
      const trimmed = text.trim()
      if (trimmed === '') return CLEAR
      if (!/^[+-]?\d+$/.test(trimmed)) return undefined
      const parsed = Number(trimmed)
      if (!Number.isFinite(parsed) || parsed < min || parsed > max) return undefined
      return { kind: 'set', value: parsed }
    },
  }
}

/**
 * A closed-vocabulary field, edited by chips or segments.
 * @param field - field name inside the settings section.
 * @param options - every accepted value.
 * @returns the conversion spec.
 */
export function enumField(field: string, options: readonly string[]): SettingsFieldSpec {
  return {
    field,
    format: (value) => (typeof value === 'string' && options.includes(value) ? value : ''),
    parse: (text) => {
      const trimmed = text.trim()
      if (trimmed === '') return CLEAR
      return options.includes(trimmed) ? { kind: 'set', value: trimmed } : undefined
    },
  }
}

/**
 * A local wall-clock `HH:MM` field.
 * @param field - field name inside the settings section.
 * @returns the conversion spec.
 */
export function clockField(field: string): SettingsFieldSpec {
  return {
    field,
    format: (value) => (typeof value === 'string' ? value : ''),
    parse: (text) => {
      const trimmed = text.trim()
      if (trimmed === '') return CLEAR
      const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
      if (match === null) return undefined
      const hours = Number(match[1])
      const minutes = Number(match[2])
      if (hours > 23 || minutes > 59) return undefined
      return { kind: 'set', value: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` }
    },
  }
}
