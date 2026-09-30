/**
 * Turn-end detection on the browser side.
 *
 * The Host already pushes every Agent's running state to connected browsers:
 * `dsh-api-session-controller` mirrors `agent/status` into the Session list the
 * Web client holds, and the Agent reports `running` exactly while it is working
 * on a turn (`dsh-agent-loop` derives it from its phase being neither `idle` nor
 * `maintenance`). So a `true → false` edge on one Session row is the handoff this
 * plugin is about — with no Host Remote, no polling, and no access to anything
 * the Session list does not already publish.
 *
 * The edge says *that* the turn ended, not *how*. Where the browser also holds
 * the Session's event window (its conversation is open in this page), the
 * matching `turn/end` record is read for the exact reason and turn number; every
 * other Session is classified as a clean handoff, which is what "the agent went
 * idle" means.
 *
 * @module dsh-your-turn/client/turnWatcher
 */

import type { Context } from '@deepseek-ai/cordis'
import type { TurnOutcome } from '../shared/settings.ts'

/**
 * The fields this module reads off the Session list snapshot.
 *
 * Declared structurally rather than imported: the official `SessionListState`
 * brands its ids and carries projection stores this plugin never touches, and a
 * local shape keeps the read surface explicit — and immune to unrelated widening
 * of the published snapshot.
 */
interface SessionListSnapshot {
  readonly ids: readonly string[]
  readonly byId: Readonly<Record<string, SessionRow | undefined>>
}

/** The one Session row this module reads. */
interface SessionRow {
  readonly running?: boolean
  readonly displayTitle?: string
  readonly cwd?: string
  readonly parentId?: string
  readonly origin?: string
}

/** One finished turn, as the browser could observe it. */
export interface TurnEndRecord {
  /** Session (and Agent) identity. */
  sessionId: string
  /** Human-facing label from the Session list. */
  title: string
  /** Session working directory, when the Host published one. */
  cwd: string | undefined
  /** Whether the Session is a subagent child rather than a root agent. */
  subagent: boolean
  /** When this page first observed the turn running. */
  startedAt: number
  /** When the running flag went false. */
  endedAt: number
  /** Observed wall-clock duration; a lower bound when the page loaded mid-turn. */
  durationMs: number
  /** Turn number from the exact `turn/end` record, when one was readable. */
  turn: number | undefined
  /** Classified outcome. */
  outcome: TurnOutcome
  /** Raw `TurnEndReason.kind` when an exact record was readable. */
  reasonKind: string | undefined
}

/**
 * Structural view of one entry of a Session event window.
 *
 * The durable event union is a large discriminated type owned by the Host
 * package; this plugin only ever looks at `turn/end`, so it reads the three
 * fields it needs and tolerates every other shape — including the client-only
 * transient rows that share the array.
 */
interface EventWindowEntry {
  readonly type?: string
  readonly event?: {
    readonly type?: string
    readonly time?: number
    readonly data?: {
      readonly turn?: number
      readonly reason?: { readonly kind?: string }
    }
  }
}

/**
 * Map a durable `TurnEndReason.kind` to this plugin's outcome vocabulary.
 *
 * `TurnEndReasonMap` is merge-extensible, so an unrecognized kind must resolve
 * to `unknown` rather than throw or be mistaken for a failure.
 *
 * @param kind - raw reason kind.
 * @returns the classified outcome.
 */
export function classifyReason(kind: string | undefined): TurnOutcome {
  switch (kind) {
    case undefined:
      return 'unknown'
    case 'completed':
      return 'completed'
    case 'error':
    case 'blocked':
      return 'failed'
    case 'aborted':
    case 'interrupted':
      return 'aborted'
    case 'max-tokens':
      return 'limited'
    case 'forked':
      // A fork seed closes a turn that was still open in the source session;
      // the loop never emits it, so it is not a handoff anyone waited for.
      return 'aborted'
    default:
      return 'unknown'
  }
}

/** Start and stop callbacks for one Session's running edge. */
export interface TurnWatcherOptions {
  /** Called once per observed turn handoff. */
  onTurnEnd(record: TurnEndRecord): void
  /** Clock injection for tests. */
  now?(): number
}

/** A running Stateful watcher. */
export interface TurnWatcher {
  /** Stop observing and drop all state. */
  dispose(): void
  /** @returns how many Sessions are currently running, for diagnostics. */
  runningCount(): number
}

/** Per-Session observation state. */
interface Observation {
  running: boolean
  since: number
  ended: number | undefined
}

/**
 * Observe the Session list and report every turn handoff.
 *
 * The first snapshot seeds state without reporting: a page that loads while a
 * turn is already running must not announce that turn's *start*, and a Session
 * that was already idle has no edge to report.
 *
 * @param ctx - Client Cordis context; must provide the `sessions` service.
 * @param options - callbacks and clock.
 * @returns the watcher handle.
 */
export function watchTurns(ctx: Context, options: TurnWatcherOptions): TurnWatcher {
  const now = options.now ?? (() => Date.now())
  const observations = new Map<string, Observation>()

  const observe = (): void => {
    const sessions = (ctx as unknown as { sessions?: SessionsFace }).sessions
    if (sessions === undefined) return
    let state: SessionListSnapshot
    try {
      state = sessions.list.getSnapshot()
    } catch (error) {
      console.error('[dsh-your-turn] session list read failed', error)
      return
    }
    const seen = new Set<string>()
    const at = now()
    for (const sessionId of state.ids) {
      const summary = state.byId[sessionId]
      if (summary === undefined) continue
      seen.add(sessionId)
      const running = summary.running === true
      const previous = observations.get(sessionId)
      if (previous === undefined) {
        observations.set(sessionId, { running, since: at, ended: running ? undefined : at })
        continue
      }
      if (previous.running === running) {
        if (running) previous.ended = undefined
        continue
      }
      if (running) {
        observations.set(sessionId, { running: true, since: at, ended: undefined })
        continue
      }
      // The handoff edge.
      const startedAt = previous.since
      observations.set(sessionId, { running: false, since: startedAt, ended: at })
      const title = summary.displayTitle
      const exact = readTurnEnd(ctx, sessionId, at)
      const record: TurnEndRecord = {
        sessionId,
        title: title === undefined || title === '' ? sessionId : title,
        cwd: summary.cwd,
        subagent: summary.origin === 'subagent' || summary.parentId !== undefined,
        startedAt,
        endedAt: at,
        durationMs: Math.max(0, at - startedAt),
        turn: exact?.turn,
        outcome: exact === undefined ? 'unknown' : classifyReason(exact.kind),
        reasonKind: exact?.kind,
      }
      try {
        options.onTurnEnd(record)
      } catch (error) {
        console.error('[dsh-your-turn] turn handler failed', error)
      }
    }
    for (const sessionId of [...observations.keys()]) {
      if (!seen.has(sessionId)) observations.delete(sessionId)
    }
  }

  const unsubscribe = sessions(ctx)?.list.subscribe(observe)
  observe()

  return {
    dispose(): void {
      unsubscribe?.()
      observations.clear()
    },
    runningCount(): number {
      let count = 0
      for (const observation of observations.values()) if (observation.running) count += 1
      return count
    },
  }
}

/** @returns the Session service, when this composition provides one. */
function sessions(ctx: Context): SessionsFace | undefined {
  return (ctx as unknown as { sessions?: SessionsFace }).sessions
}

/** The slice of `ctx.sessions` this module reads. */
interface SessionsFace {
  readonly list: {
    getSnapshot(): SessionListSnapshot
    subscribe(listener: () => void): () => void
  }
  binding(id: string): BindingFace | undefined
}

/** The slice of a Session binding this module reads. */
interface BindingFace {
  readonly eventSource: { getSnapshot(): { entries: readonly unknown[] } }
}

/**
 * Read the newest readable `turn/end` record for one Session.
 *
 * The record is only trusted when it is recent relative to the edge being
 * reported: a Session whose conversation is open keeps its whole loaded window,
 * and the *previous* turn's end must not be attributed to this one.
 *
 * @param ctx - Client context.
 * @param sessionId - Session to inspect.
 * @param at - the moment the running flag went false.
 * @returns the reason kind and turn number, when a fresh record was found.
 */
function readTurnEnd(
  ctx: Context,
  sessionId: string,
  at: number,
): { kind: string | undefined; turn: number | undefined } | undefined {
  try {
    const binding = sessions(ctx)?.binding(sessionId)
    if (binding === undefined) return undefined
    const entries = binding.eventSource.getSnapshot().entries as readonly EventWindowEntry[]
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index]
      if (entry?.type !== 'event') continue
      const event = entry.event
      if (event?.type !== 'turn/end') continue
      const time = typeof event.time === 'number' ? event.time : undefined
      if (time !== undefined && at - time > 10_000) return undefined
      return { kind: event.data?.reason?.kind, turn: event.data?.turn }
    }
    return undefined
  } catch (error) {
    console.warn('[dsh-your-turn] turn/end lookup failed', error)
    return undefined
  }
}
