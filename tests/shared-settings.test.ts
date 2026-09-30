/**
 * Pure configuration behaviour: defaults, validation of a hostile or stale
 * settings section, clock parsing, the quiet window, and outcome scoping.
 */

import { describe, expect, it } from 'vitest'
import {
  CONFIG_DEFAULTS,
  LIMITS,
  clockMinutes,
  insideQuietWindow,
  normalizeClock,
  normalizeConfig,
  outcomeInScope,
} from '../src/shared/settings.ts'

describe('normalizeConfig', () => {
  it('returns the complete defaults for absent input', () => {
    expect(normalizeConfig(undefined)).toEqual(CONFIG_DEFAULTS)
    expect(normalizeConfig(null)).toEqual(CONFIG_DEFAULTS)
    expect(normalizeConfig({})).toEqual(CONFIG_DEFAULTS)
    expect(normalizeConfig('not an object')).toEqual(CONFIG_DEFAULTS)
  })

  it('accepts a valid partial section', () => {
    const config = normalizeConfig({ enabled: false, volume: 12, surface: 'toast' })
    expect(config.enabled).toBe(false)
    expect(config.volume).toBe(12)
    expect(config.surface).toBe('toast')
    // Untouched fields keep their defaults.
    expect(config.soundPreset).toBe(CONFIG_DEFAULTS.soundPreset)
  })

  it('rejects unknown vocabulary values by falling back', () => {
    const config = normalizeConfig({ surface: 'hologram', soundPreset: 'gong', notifyOn: 'never' })
    expect(config.surface).toBe(CONFIG_DEFAULTS.surface)
    expect(config.soundPreset).toBe(CONFIG_DEFAULTS.soundPreset)
    expect(config.notifyOn).toBe(CONFIG_DEFAULTS.notifyOn)
  })

  it('clamps and rounds numbers into their declared bounds', () => {
    expect(normalizeConfig({ volume: 900 }).volume).toBe(LIMITS.volume.max)
    expect(normalizeConfig({ volume: -5 }).volume).toBe(LIMITS.volume.min)
    expect(normalizeConfig({ volume: 33.7 }).volume).toBe(34)
    expect(normalizeConfig({ autoDismissSeconds: 1e9 }).autoDismissSeconds).toBe(LIMITS.autoDismissSeconds.max)
    expect(normalizeConfig({ minTurnSeconds: Number.NaN }).minTurnSeconds).toBe(LIMITS.minTurnSeconds.min)
  })

  it('ignores non-boolean and non-numeric payloads', () => {
    const config = normalizeConfig({
      enabled: 'yes',
      volume: 'loud',
      quietHoursEnabled: 1,
      flashTitle: null,
    })
    expect(config.enabled).toBe(CONFIG_DEFAULTS.enabled)
    expect(config.volume).toBe(CONFIG_DEFAULTS.volume)
    expect(config.quietHoursEnabled).toBe(CONFIG_DEFAULTS.quietHoursEnabled)
    expect(config.flashTitle).toBe(CONFIG_DEFAULTS.flashTitle)
  })

  it('accepts every shipped preset, including the failure voice', () => {
    for (const preset of ['chime', 'ping', 'marimba', 'arcade', 'drop', 'alert', 'none']) {
      expect(normalizeConfig({ soundPreset: preset }).soundPreset).toBe(preset)
      expect(normalizeConfig({ errorSoundPreset: preset }).errorSoundPreset).toBe(preset)
    }
  })

  it('normalizes clock fields and rejects malformed ones', () => {
    expect(normalizeConfig({ quietHoursStart: '7:05' }).quietHoursStart).toBe('07:05')
    expect(normalizeConfig({ quietHoursEnd: '23:59' }).quietHoursEnd).toBe('23:59')
    expect(normalizeConfig({ quietHoursStart: '25:00' }).quietHoursStart).toBe(CONFIG_DEFAULTS.quietHoursStart)
    expect(normalizeConfig({ quietHoursStart: 'later' }).quietHoursStart).toBe(CONFIG_DEFAULTS.quietHoursStart)
  })
})

describe('normalizeClock', () => {
  it('pads and validates', () => {
    expect(normalizeClock('9:30', '00:00')).toBe('09:30')
    expect(normalizeClock(' 08:00 ', '00:00')).toBe('08:00')
    expect(normalizeClock('08:0', '00:00')).toBe('00:00')
    expect(normalizeClock('24:00', '00:00')).toBe('00:00')
    expect(normalizeClock(undefined, '00:00')).toBe('00:00')
  })
})

describe('clockMinutes', () => {
  it('converts valid clocks and rejects the rest', () => {
    expect(clockMinutes('00:00')).toBe(0)
    expect(clockMinutes('22:30')).toBe(22 * 60 + 30)
    expect(clockMinutes('bad')).toBeUndefined()
  })
})

describe('insideQuietWindow', () => {
  it('handles a same-day window', () => {
    const start = 9 * 60
    const end = 17 * 60
    expect(insideQuietWindow(8 * 60, start, end)).toBe(false)
    expect(insideQuietWindow(9 * 60, start, end)).toBe(true)
    expect(insideQuietWindow(16 * 60 + 59, start, end)).toBe(true)
    expect(insideQuietWindow(17 * 60, start, end)).toBe(false)
  })

  it('handles a window that wraps past midnight', () => {
    const start = 22 * 60
    const end = 8 * 60
    expect(insideQuietWindow(23 * 60, start, end)).toBe(true)
    expect(insideQuietWindow(2 * 60, start, end)).toBe(true)
    expect(insideQuietWindow(7 * 60 + 59, start, end)).toBe(true)
    expect(insideQuietWindow(8 * 60, start, end)).toBe(false)
    expect(insideQuietWindow(12 * 60, start, end)).toBe(false)
  })

  it('treats an empty window as a full day', () => {
    expect(insideQuietWindow(0, 0, 0)).toBe(true)
    expect(insideQuietWindow(720, 0, 0)).toBe(true)
  })
})

describe('outcomeInScope', () => {
  it('narrows by outcome as configured', () => {
    expect(outcomeInScope('success', 'completed')).toBe(true)
    expect(outcomeInScope('success', 'failed')).toBe(false)
    expect(outcomeInScope('success', 'aborted')).toBe(false)

    expect(outcomeInScope('success-and-failure', 'completed')).toBe(true)
    expect(outcomeInScope('success-and-failure', 'failed')).toBe(true)
    expect(outcomeInScope('success-and-failure', 'aborted')).toBe(false)

    for (const outcome of ['completed', 'failed', 'aborted', 'limited', 'unknown'] as const) {
      expect(outcomeInScope('all', outcome)).toBe(true)
    }
  })

  it('follows the success branch when the outcome could not be classified', () => {
    // An unreadable turn/end means "the agent went idle", not "something broke".
    expect(outcomeInScope('success', 'unknown')).toBe(true)
    expect(outcomeInScope('success-and-failure', 'unknown')).toBe(true)
  })
})
