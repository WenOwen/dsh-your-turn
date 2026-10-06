/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import { AdaptiveSettings, BrowserSettings, BROWSER_SETTINGS_KEY } from '../src/client/browserSettings.ts'
import { normalizeConfig, type YourTurnConfig } from '../src/shared/settings.ts'

beforeEach(() => localStorage.clear())
describe('browser-local remote settings', () => {
  it('stages through atomic writes, publishes selection and survives reload', async () => {
    const form = new BrowserSettings()
    const listener = vi.fn(); form.subscribe(listener)
    expect(form.getSnapshot().value?.surface).toBe('modal')
    expect(await form.mutate([{ op: 'set', path: ['surface'], value: 'toast' }, { op: 'set', path: ['onlyWhenUnfocused'], value: false }], 0)).toBe(true)
    expect(listener).toHaveBeenCalledOnce()
    expect(new BrowserSettings().getSnapshot().value).toMatchObject({ surface: 'toast', onlyWhenUnfocused: false })
    expect(await form.mutate([{ op: 'unset', path: ['surface'] }], 0)).toBe(false)
    expect(await form.unset('surface')).toBe(true)
    expect(form.getSnapshot().value?.surface).toBe('modal')
  })
  it('rejects foreign/nested fields and tolerates corrupted or invalid storage', async () => {
    localStorage.setItem(BROWSER_SETTINGS_KEY, '{broken')
    const form = new BrowserSettings()
    expect(form.getSnapshot().value?.surface).toBe('modal')
    expect(await form.set('__proto__', {})).toBe(false)
    expect(await form.set('surface', 'alien')).toBe(false)
    expect(await form.set('volume', 999)).toBe(false)
    expect(await form.mutate([{ op: 'set', path: ['surface', 'nested'], value: 'toast' }])).toBe(false)
    localStorage.setItem(BROWSER_SETTINGS_KEY, JSON.stringify({ surface: 'alien', volume: 999, extra: 1 }))
    expect(new BrowserSettings().getSnapshot()).toMatchObject({ value: { surface: 'modal', volume: 100 }, user: { surface: 'modal', volume: 100 } })
  })
  it('ignores legacy notification filters in browser settings and drops them on the next write', async () => {
    const raw = {
      muteAll: true, notifyOn: 'success', quietHoursEnabled: true,
      quietHoursStart: '11:00', quietHoursEnd: '13:00', volume: 35,
      minTurnSeconds: 3600, enabled: false, includeSubagents: true,
    }
    localStorage.setItem(BROWSER_SETTINGS_KEY, JSON.stringify(raw))
    const form = new BrowserSettings()
    expect(form.getSnapshot().value).toEqual(normalizeConfig(raw))
    for (const field of ['enabled', 'includeSubagents', 'muteAll', 'notifyOn', 'quietHoursEnabled', 'quietHoursStart', 'quietHoursEnd', 'minTurnSeconds']) {
      expect(form.getSnapshot().value).not.toHaveProperty(field)
      expect(await form.set(field, raw[field as keyof typeof raw])).toBe(false)
    }
    expect(await form.set('volume', 45)).toBe(true)
    // Browser persistence stores overrides, not a copy of every default.
    expect(JSON.parse(localStorage.getItem(BROWSER_SETTINGS_KEY)!)).toEqual({ volume: 45 })
    expect(new BrowserSettings().getSnapshot().value).toEqual(normalizeConfig({ volume: 45 }))
  })
  it('keeps accepted values unchanged if storage refuses a save', async () => {
    const form = new BrowserSettings()
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(await form.set('surface', 'toast')).toBe(false)
    expect(form.getSnapshot().value?.surface).toBe('modal')
    write.mockRestore()
  })
  it('never calls the Host writer in memory mode, but preserves real read-only Host forms', async () => {
    const host = { getSnapshot: () => ({ status: 'unavailable', mode: 'memory', writable: false }), subscribe: () => () => {}, set: vi.fn(), unset: vi.fn(), mutate: vi.fn() } as unknown as ConfigForm<Partial<YourTurnConfig>>
    const remote = new AdaptiveSettings(host)
    expect(remote.getSnapshot()).toMatchObject({ status: 'ready', writable: true, mode: 'memory' })
    expect(await remote.set('surface', 'toast')).toBe(true)
    expect(host.set).not.toHaveBeenCalled()
    const readOnly = { ...host, getSnapshot: () => ({ status: 'ready', mode: 'host', writable: false }) } as unknown as ConfigForm<Partial<YourTurnConfig>>
    expect(new AdaptiveSettings(readOnly).getSnapshot().writable).toBe(false)
  })
})
