/**
 * Browser-local reminder state.
 *
 * The settings document holds *policy* — what the plugin should do. This module
 * holds the two facts that are inherently about one browser and one moment:
 * which sessions this user silenced, and which reminders they pushed back. They
 * are versioned, validated on read, and cheap to lose, so storage being disabled
 * degrades to an in-memory copy rather than an error.
 *
 * @module dsh-your-turn/client/localState
 */

/** The persisted shape. */
export interface LocalState {
  /** Session ids silenced in this browser. */
  mutedSessions: string[]
  /** Session id → epoch ms before which reminders are suppressed. */
  snoozeUntil: Record<string, number>
}

/** Versioned key: an incompatible shape bumps the version instead of migrating. */
export const STORAGE_KEY = 'dsh-your-turn/state/v1'

/** Silenced-session cap, so the key cannot grow without bound. */
const MAX_MUTED = 200

/** @returns an empty state. */
export function emptyLocalState(): LocalState {
  return { mutedSessions: [], snoozeUntil: {} }
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
    const muted = Array.isArray(record.mutedSessions)
      ? record.mutedSessions.filter((id): id is string => typeof id === 'string' && id !== '').slice(-MAX_MUTED)
      : []
    const snooze: Record<string, number> = {}
    if (typeof record.snoozeUntil === 'object' && record.snoozeUntil !== null) {
      const now = Date.now()
      for (const [id, value] of Object.entries(record.snoozeUntil as Record<string, unknown>)) {
        // Expired entries are dropped on read: the file is a cache, not a log.
        if (typeof value === 'number' && Number.isFinite(value) && value > now) snooze[id] = value
      }
    }
    return { mutedSessions: muted, snoozeUntil: snooze }
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
        mutedSessions: state.mutedSessions.slice(-MAX_MUTED),
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
