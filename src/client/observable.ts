/**
 * A minimal snapshot source, plus the React binding for it.
 *
 * The plugin holds three pieces of browser state — the resolved configuration,
 * the reminder queue, and the title-flash flag — and every one of them is a
 * root-scoped singleton owned by this plugin instance. A hand-rolled source
 * keeps that state in one plain object with no per-scope instance machinery,
 * no store seat on the Slot registration, and nothing to dispose: the React
 * binding reads it through `useSyncExternalStore`, which is the same contract
 * the framework's snapshot stores expose.
 *
 * @module dsh-your-turn/client/observable
 */

import { useCallback, useSyncExternalStore } from 'react'

/** A read-only snapshot source; the shape `useSyncExternalStore` consumes. */
export interface SnapshotSource<T> {
  /** @returns the current value; reference-stable between changes. */
  getSnapshot(): T
  /**
   * Observe value replacement.
   * @param listener - change callback.
   * @returns the unsubscribe function.
   */
  subscribe(listener: () => void): () => void
}

/** A writable {@link SnapshotSource}. */
export class Observable<T> implements SnapshotSource<T> {
  private value: T
  private readonly listeners = new Set<() => void>()

  /** @param initial - starting value. */
  constructor(initial: T) {
    this.value = initial
  }

  /** @returns the current value. */
  getSnapshot = (): T => this.value

  /**
   * Observe value replacement.
   * @param listener - change callback.
   * @returns the unsubscribe function.
   */
  subscribe = (listener: () => void): () => void => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Replace the value and notify when it actually changed.
   * @param next - next value.
   */
  set(next: T): void {
    if (Object.is(this.value, next)) return
    this.value = next
    this.publish()
  }

  /**
   * Replace the value from its predecessor; the updater must return the same
   * reference when nothing changed, so callers can build on immutability.
   * @param updater - next-value function.
   */
  update(updater: (previous: T) => T): void {
    this.set(updater(this.value))
  }

  /** Notify every subscriber, tolerating one throwing listener. */
  private publish(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener()
      } catch (error) {
        console.error('[dsh-your-turn] snapshot listener failed', error)
      }
    }
  }
}

/**
 * Subscribe a component to a snapshot source.
 * @param source - the source to read.
 * @returns the current value, re-rendering on change.
 */
export function useSnapshot<T>(source: SnapshotSource<T>): T {
  const subscribe = useCallback((listener: () => void) => source.subscribe(listener), [source])
  const getSnapshot = useCallback(() => source.getSnapshot(), [source])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
