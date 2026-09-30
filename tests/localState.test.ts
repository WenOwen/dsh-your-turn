/**
 * Browser-local reminder state: the versioned key, validation of a corrupt or
 * stale payload, expiry of snoozes, and a refusing storage.
 */

import { describe, expect, it } from 'vitest'
import { STORAGE_KEY, emptyLocalState, loadLocalState, saveLocalState, type LocalState } from '../src/client/localState.ts'

/** An in-memory `Storage` that can be told to refuse. */
class FakeStorage implements Storage {
  private readonly map = new Map<string, string>()
  refuse = false

  get length(): number {
    return this.map.size
  }

  clear(): void {
    this.map.clear()
  }

  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }

  setItem(key: string, value: string): void {
    if (this.refuse) throw new Error('QuotaExceededError')
    this.map.set(key, value)
  }
}

describe('loadLocalState', () => {
  it('returns empty state when nothing is stored', () => {
    expect(loadLocalState(new FakeStorage())).toEqual(emptyLocalState())
  })

  it('round-trips what saveLocalState wrote', () => {
    const storage = new FakeStorage()
    const state: LocalState = { mutedSessions: ['a', 'b'], snoozeUntil: { c: Date.now() + 60_000 } }
    expect(saveLocalState(state, storage)).toBe(true)
    expect(loadLocalState(storage)).toEqual(state)
  })

  it('falls back to empty state for corrupt JSON', () => {
    const storage = new FakeStorage()
    storage.setItem(STORAGE_KEY, '{ this is not json')
    expect(loadLocalState(storage)).toEqual(emptyLocalState())
  })

  it('drops fields that are not the shape it wrote', () => {
    const storage = new FakeStorage()
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ mutedSessions: ['ok', 7, '', null], snoozeUntil: { keep: Date.now() + 1000, drop: 'soon' } }),
    )
    const state = loadLocalState(storage)
    expect(state.mutedSessions).toEqual(['ok'])
    expect(Object.keys(state.snoozeUntil)).toEqual(['keep'])
  })

  it('drops expired snoozes and non-object roots', () => {
    const storage = new FakeStorage()
    storage.setItem(STORAGE_KEY, JSON.stringify({ mutedSessions: [], snoozeUntil: { past: Date.now() - 1 } }))
    expect(loadLocalState(storage).snoozeUntil).toEqual({})

    storage.setItem(STORAGE_KEY, JSON.stringify(['not', 'an', 'object']))
    expect(loadLocalState(storage)).toEqual(emptyLocalState())
  })

  it('survives a storage that throws on read and a storage that is absent', () => {
    const hostile = new FakeStorage()
    hostile.getItem = () => {
      throw new Error('SecurityError')
    }
    expect(loadLocalState(hostile)).toEqual(emptyLocalState())
    expect(loadLocalState(undefined as unknown as Storage)).toEqual(emptyLocalState())
  })

  it('caps the silenced list so the key cannot grow without bound', () => {
    const storage = new FakeStorage()
    const many = Array.from({ length: 500 }, (_, index) => `session-${String(index)}`)
    saveLocalState({ mutedSessions: many, snoozeUntil: {} }, storage)
    const state = loadLocalState(storage)
    expect(state.mutedSessions).toHaveLength(200)
    expect(state.mutedSessions.at(-1)).toBe('session-499')
  })
})

describe('saveLocalState', () => {
  it('reports a refused write instead of throwing', () => {
    const storage = new FakeStorage()
    storage.refuse = true
    expect(saveLocalState(emptyLocalState(), storage)).toBe(false)
  })

  it('reports failure when there is no storage at all', () => {
    expect(saveLocalState(emptyLocalState(), undefined as unknown as Storage)).toBe(false)
  })
})
