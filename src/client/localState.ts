/**
 * Browser-local reminder state.
 *
 * The settings document holds *policy* — what the plugin should do. This module
 * holds browser-local snooze deadlines, validated on read. Legacy muted-session
 * lists are deliberately ignored now that session muting has been removed.
 * Disabled storage degrades to an in-memory copy rather than an error.
 *
 * @module dsh-your-turn/client/localState
 */

/** The persisted shape. */
export interface LocalState {
  /** Session id → epoch ms before which reminders are suppressed. */
  snoozeUntil: Record<string, number>
}

/** Versioned key: an incompatible shape bumps the version instead of migrating. */
export const STORAGE_KEY = 'dsh-your-turn/state/v1'

/** @returns an empty state. */
export function emptyLocalState(): LocalState {
  return { snoozeUntil: {} }
}

/**
 * Read persisted state, dropping anything malformed.
 *
 * @param storage - storage to read; defaults to `window.localStorage`.
 * @returns validated state, or the empty state when nothing usable is stored.
 */
export function loadLocalState(storage?: Storage): LocalState {
  const target = storage ?? defaultStorage()
  if (target === undefined) return emptyLocalState()
  let raw: string | null
  try {
    raw = target.getItem(STORAGE_KEY)
  } catch {
    return emptyLocalState()
  }
  if (raw === null || raw === '') return emptyLocalState()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return emptyLocalState()
    const record = parsed as Record<string, unknown>
    const snooze: Record<string, number> = {}
    if (typeof record.snoozeUntil === 'object' && record.snoozeUntil !== null) {
      const now = Date.now()
      for (const [id, value] of Object.entries(record.snoozeUntil as Record<string, unknown>)) {
        // Expired entries are dropped on read: the file is a cache, not a log.
        if (typeof value === 'number' && Number.isFinite(value) && value > now) snooze[id] = value
      }
    }
    return { snoozeUntil: snooze }
  } catch {
    return emptyLocalState()
  }
}

/**
 * Persist state.
 * @param state - state to write.
 * @param storage - storage to write; defaults to `window.localStorage`.
 * @returns whether the write landed; a refusal is not an error the caller must surface.
 */
export function saveLocalState(state: LocalState, storage?: Storage): boolean {
  const target = storage ?? defaultStorage()
  if (target === undefined) return false
  try {
    target.setItem(
      STORAGE_KEY,
      JSON.stringify({
        snoozeUntil: state.snoozeUntil,
      }),
    )
    return true
  } catch {
    return false
  }
}

/** @returns the page's `localStorage`, when it is reachable. */
function defaultStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    // Access itself throws when storage is blocked by policy.
    return undefined
  }
}
