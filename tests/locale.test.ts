/**
 * Dictionary integrity.
 *
 * The typed `ctx.locale.register(ns, dicts)` call already makes a missing or
 * extra English key a compile error; this test pins the same invariant so a
 * locale edit that widens the Chinese dictionary without the English one fails
 * in CI rather than at plugin load in someone's browser.
 */

import { describe, expect, it } from 'vitest'
import { DICTS, NS, type YourTurnKey } from '../src/client/locale.ts'
import { ALL_FIELDS, FIELD_SPECS, GROUPS } from '../src/client/formSpecs.ts'

describe('locale dictionaries', () => {
  it('ships exactly the two built-in locales', () => {
    expect(Object.keys(DICTS).sort()).toEqual(['en', 'zh'])
  })

  it('has identical key sets in both languages', () => {
    const zh = Object.keys(DICTS.zh).sort()
    const en = Object.keys(DICTS.en).sort()
    expect(en).toEqual(zh)
  })

  it('leaves no string empty or untranslated', () => {
    for (const [locale, dict] of Object.entries(DICTS)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value, `${locale}.${key}`).toBeTypeOf('string')
        expect(value.trim(), `${locale}.${key}`).not.toBe('')
      }
    }
    // A copy-paste that left Chinese text in the English dictionary.
    expect(Object.values(DICTS.en).some((value) => /[\u4e00-\u9fff]/.test(value))).toBe(false)
  })

  it('declares the namespace this package owns', () => {
    expect(NS).toBe('yourTurn')
  })
})

describe('settings layout', () => {
  it('gives every rendered row a staging spec', () => {
    const spectra = new Set(FIELD_SPECS.map((spec) => spec.field))
    for (const field of ALL_FIELDS) expect(spectra.has(field), field).toBe(true)
  })

  it('renders every staging spec exactly once', () => {
    expect([...ALL_FIELDS].sort()).toEqual(FIELD_SPECS.map((spec) => spec.field).sort())
    expect(new Set(ALL_FIELDS).size).toBe(ALL_FIELDS.length)
  })

  it('points every row at a dictionary key that exists', () => {
    const keys = new Set(Object.keys(DICTS.zh) as YourTurnKey[])
    for (const group of GROUPS) {
      if (group.titleKey !== undefined) expect(keys.has(group.titleKey), group.titleKey).toBe(true)
      for (const row of group.rows) {
        expect(keys.has(row.labelKey), row.labelKey).toBe(true)
        if (row.control.kind === 'chips') {
          for (const option of row.control.optionKeys) {
            expect(keys.has(option.labelKey), option.labelKey).toBe(true)
          }
        }
      }
    }
  })
})
