/**
 * Draft-text conversions. The properties that matter are the negative ones:
 * an out-of-range or unrecognized draft must be refused rather than coerced,
 * because the form model turns a refusal into a blocked save instead of a
 * silently different value.
 */

import { describe, expect, it } from 'vitest'
import { LIMITS, SOUND_PRESETS, SURFACES } from '../src/shared/settings.ts'
import { boolField, clockField, enumField, intField } from '../src/client/fieldSpecs.ts'

describe('boolField', () => {
  const spec = boolField('enabled')

  it('renders stored booleans and nothing else', () => {
    expect(spec.format(true)).toBe('true')
    expect(spec.format(false)).toBe('false')
    expect(spec.format(undefined)).toBe('')
    expect(spec.format('true')).toBe('')
  })

  it('parses the spellings a user might type', () => {
    for (const text of ['true', 'TRUE', ' 1 ', 'on', 'yes']) {
      expect(spec.parse(text)).toEqual({ kind: 'set', value: true })
    }
    for (const text of ['false', '0', 'off', 'no']) {
      expect(spec.parse(text)).toEqual({ kind: 'set', value: false })
    }
  })

  it('clears on an empty draft and refuses anything else', () => {
    expect(spec.parse('   ')).toEqual({ kind: 'clear' })
    expect(spec.parse('maybe')).toBeUndefined()
  })
})

describe('intField', () => {
  const spec = intField('volume', LIMITS.volume.min, LIMITS.volume.max)

  it('rounds for display', () => {
    expect(spec.format(70)).toBe('70')
    expect(spec.format(70.4)).toBe('70')
    expect(spec.format('70')).toBe('')
  })

  it('accepts in-range integers and clears on empty', () => {
    expect(spec.parse('0')).toEqual({ kind: 'set', value: 0 })
    expect(spec.parse('100')).toEqual({ kind: 'set', value: 100 })
    expect(spec.parse('')).toEqual({ kind: 'clear' })
  })

  it('refuses out-of-range, fractional, and non-numeric drafts', () => {
    expect(spec.parse('101')).toBeUndefined()
    expect(spec.parse('-1')).toBeUndefined()
    expect(spec.parse('70.5')).toBeUndefined()
    expect(spec.parse('70abc')).toBeUndefined()
    expect(spec.parse('1e3')).toBeUndefined()
  })
})

describe('enumField', () => {
  const spec = enumField('surface', SURFACES)

  it('renders a member of the vocabulary and blanks anything else', () => {
    expect(spec.format('toast')).toBe('toast')
    expect(spec.format('hologram')).toBe('')
  })

  it('accepts every declared member', () => {
    for (const value of SURFACES) expect(spec.parse(value)).toEqual({ kind: 'set', value })
    for (const value of SOUND_PRESETS) {
      expect(enumField('soundPreset', SOUND_PRESETS).parse(value)).toEqual({ kind: 'set', value })
    }
  })

  it('refuses values outside the vocabulary', () => {
    expect(spec.parse('hologram')).toBeUndefined()
    expect(spec.parse('')).toEqual({ kind: 'clear' })
  })
})

describe('clockField', () => {
  const spec = clockField('quietHoursStart')

  it('passes stored text through', () => {
    expect(spec.format('22:00')).toBe('22:00')
    expect(spec.format(undefined)).toBe('')
  })

  it('normalizes an unpadded hour and rejects impossible times', () => {
    expect(spec.parse('7:05')).toEqual({ kind: 'set', value: '07:05' })
    expect(spec.parse('23:59')).toEqual({ kind: 'set', value: '23:59' })
    expect(spec.parse('24:00')).toBeUndefined()
    expect(spec.parse('12:60')).toBeUndefined()
    expect(spec.parse('noon')).toBeUndefined()
    expect(spec.parse('')).toEqual({ kind: 'clear' })
  })
})
