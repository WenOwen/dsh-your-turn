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
    const config = normalizeConfig({ volume: 12, surface: 'toast' })
    expect(config.volume).toBe(12)
    expect(config.surface).toBe('toast')
    // Untouched fields keep their defaults.
    expect(config.soundPreset).toBe(CONFIG_DEFAULTS.soundPreset)
  })

  it('folds the retired "both" surface back onto the default', () => {
    // An older settings document may still ask for popup *and* banner; the
    // vocabulary is one-of now, so it resolves to modal rather than drawing two.
    expect(normalizeConfig({ surface: 'both' }).surface).toBe('modal')
    expect(normalizeConfig({ surface: 'both' })).toEqual(CONFIG_DEFAULTS)
  })

  it('rejects unknown vocabulary values by falling back', () => {
    const config = normalizeConfig({ surface: 'hologram', soundPreset: 'gong' })
    expect(config.surface).toBe(CONFIG_DEFAULTS.surface)
    expect(config.soundPreset).toBe(CONFIG_DEFAULTS.soundPreset)
  })

  it('clamps and rounds numbers into their declared bounds', () => {
    expect(normalizeConfig({ volume: 900 }).volume).toBe(LIMITS.volume.max)
    expect(normalizeConfig({ volume: -5 }).volume).toBe(LIMITS.volume.min)
    expect(normalizeConfig({ volume: 33.7 }).volume).toBe(34)
    expect(normalizeConfig({ autoDismissSeconds: 1 })).not.toHaveProperty('autoDismissSeconds')
    expect(normalizeConfig({ minTurnSeconds: 3600 })).not.toHaveProperty('minTurnSeconds')
  })

  it('ignores non-boolean and non-numeric payloads', () => {
    const config = normalizeConfig({
      volume: 'loud',
      flashTitle: null,
    })
    expect(config.volume).toBe(CONFIG_DEFAULTS.volume)
    expect(config.flashTitle).toBe(CONFIG_DEFAULTS.flashTitle)
  })

  it('accepts every shipped preset, including the failure voice', () => {
    for (const preset of ['chime', 'ping', 'marimba', 'arcade', 'drop', 'alert', 'none']) {
      expect(normalizeConfig({ soundPreset: preset }).soundPreset).toBe(preset)
      expect(normalizeConfig({ errorSoundPreset: preset }).errorSoundPreset).toBe(preset)
    }
  })

  it('ignores legacy master-switch, subagent, outcome, master-mute and quiet-hours fields', () => {
    const legacy = {
      enabled: false,
      includeSubagents: true,
      notifyOn: 'success',
      muteAll: true,
      quietHoursEnabled: true,
      quietHoursStart: '11:00',
      quietHoursEnd: '13:00',
    }
    const config = normalizeConfig({ ...legacy, volume: 35 })
    expect(config).toEqual({ ...CONFIG_DEFAULTS, volume: 35 })
    for (const field of Object.keys(legacy)) {
      expect(config).not.toHaveProperty(field)
      expect(CONFIG_DEFAULTS).not.toHaveProperty(field)
    }
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
