/**
 * Turn-end detection against a fake Session list — the real service face
 * (`list.getSnapshot` / `list.subscribe` / `binding`) with scripted transitions,
 * so the assertions are about what the watcher reports, not about how it reads.
 */

import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { classifyReason, watchTurns, type TurnEndRecord } from '../src/client/turnWatcher.ts'

/** One scripted Session row. */
interface Row {
  running?: boolean
  displayTitle?: string
  cwd?: string
  parentId?: string
  origin?: string
}

/** Minimal stand-in for `ctx.sessions`. */
class FakeSessions {
  private rows: Record<string, Row> = {}
  private readonly listeners = new Set<() => void>()
  private readonly bindings = new Map<string, { eventSource: { getSnapshot(): { entries: readonly unknown[] } } }>()

  readonly list = {
    getSnapshot: (): { ids: readonly string[]; byId: Readonly<Record<string, Row | undefined>> } => ({
      ids: Object.keys(this.rows),
      byId: this.rows,
    }),
    subscribe: (listener: () => void): (() => void) => {
      this.listeners.add(listener)
      return () => {
        this.listeners.delete(listener)
      }
    },
  }

  binding(id: string): { eventSource: { getSnapshot(): { entries: readonly unknown[] } } } | undefined {
    return this.bindings.get(id)
  }

  /** Replace the snapshot and notify subscribers, as the real store does. */
  publish(rows: Record<string, Row>): void {
    this.rows = rows
    for (const listener of [...this.listeners]) listener()
  }

  /** Attach a readable event window to one Session. */
  attachWindow(id: string, entries: readonly unknown[]): void {
    this.bindings.set(id, { eventSource: { getSnapshot: () => ({ entries }) } })
  }
}

/** A durable `turn/end` row shaped like the real event window entry. */
function turnEndEntry(time: number, kind: string, turn: number): unknown {
  return { type: 'event', event: { type: 'turn/end', time, seq: 1, data: { turn, reason: { kind } } } }
}

/** A live-chunk row, which shares the window array and must be skipped. */
function transientEntry(): unknown {
  return { type: 'transient', event: { type: 'assistant/live-chunk', seq: 2, data: {} } }
}

function setup(): {
  sessions: FakeSessions
  ctx: Context
  records: TurnEndRecord[]
  setClock(value: number): void
  watcher: ReturnType<typeof watchTurns>
} {
  const sessions = new FakeSessions()
  const records: TurnEndRecord[] = []
  let clock = 1_000_000
  const ctx = { sessions } as unknown as Context
  const watcher = watchTurns(ctx, {
    onTurnEnd: (record) => records.push(record),
    now: () => clock,
  })
  return {
    sessions,
    ctx,
    records,
    setClock: (value: number) => {
      clock = value
    },
    watcher,
  }
}

describe('watchTurns', () => {
  it('reports nothing for a Session that is already idle at page load', () => {
    const harness = setup()
    harness.sessions.publish({ a: { running: false, displayTitle: 'idle' } })
    expect(harness.records).toEqual([])
    harness.watcher.dispose()
  })

  it('reports one handoff when the running flag falls, with the observed duration', () => {
    const harness = setup()
    harness.sessions.publish({ a: { running: true, displayTitle: 'Refactor auth' } })
    expect(harness.records).toEqual([])

    harness.setClock(1_000_000 + 12_500)
    harness.sessions.publish({ a: { running: false, displayTitle: 'Refactor auth' } })

    expect(harness.records).toHaveLength(1)
    const record = harness.records[0]!
    expect(record.sessionId).toBe('a')
    expect(record.title).toBe('Refactor auth')
    expect(record.durationMs).toBe(12_500)
    expect(record.outcome).toBe('unknown')
    expect(record.reasonKind).toBeUndefined()
    expect(record.subagent).toBe(false)
    harness.watcher.dispose()
  })

  it('does not re-report a Session that stays idle across snapshots', () => {
    const harness = setup()
    harness.sessions.publish({ a: { running: true } })
    harness.sessions.publish({ a: { running: false } })
    harness.sessions.publish({ a: { running: false } })
    harness.sessions.publish({ a: { running: false, displayTitle: 'renamed' } })
    expect(harness.records).toHaveLength(1)
    harness.watcher.dispose()
  })

  it('reports a second handoff after the Session runs again', () => {
    const harness = setup()
    harness.sessions.publish({ a: { running: true } })
    harness.setClock(1_000_100)
    harness.sessions.publish({ a: { running: false } })
    harness.setClock(1_000_200)
    harness.sessions.publish({ a: { running: true } })
    harness.setClock(1_000_500)
    harness.sessions.publish({ a: { running: false } })
    expect(harness.records).toHaveLength(2)
    expect(harness.records[1]!.durationMs).toBe(300)
    harness.watcher.dispose()
  })

  it('reads the exact reason and turn from a readable event window', () => {
    const harness = setup()
    harness.sessions.attachWindow('a', [transientEntry(), turnEndEntry(1_000_050, 'error', 7)])
    harness.sessions.publish({ a: { running: true } })
    harness.setClock(1_000_100)
    harness.sessions.publish({ a: { running: false } })

    const record = harness.records[0]!
    expect(record.reasonKind).toBe('error')
    expect(record.turn).toBe(7)
    expect(record.outcome).toBe('failed')
    harness.watcher.dispose()
  })

  it('ignores a turn/end that is too old to belong to this handoff', () => {
    const harness = setup()
    harness.sessions.attachWindow('a', [turnEndEntry(900_000, 'completed', 3)])
    harness.sessions.publish({ a: { running: true } })
    harness.setClock(1_000_000)
    harness.sessions.publish({ a: { running: false } })
    expect(harness.records[0]!.outcome).toBe('unknown')
    expect(harness.records[0]!.turn).toBeUndefined()
    harness.watcher.dispose()
  })

  it('marks subagent Sessions from either lineage field', () => {
    const harness = setup()
    harness.sessions.publish({
      child: { running: true, origin: 'subagent' },
      adopted: { running: true, parentId: 'root' },
      root: { running: true },
    })
    harness.setClock(1_000_400)
    harness.sessions.publish({
      child: { running: false, origin: 'subagent' },
      adopted: { running: false, parentId: 'root' },
      root: { running: false },
    })
    const byId = new Map(harness.records.map((record) => [record.sessionId, record.subagent]))
    expect(byId.get('child')).toBe(true)
    expect(byId.get('adopted')).toBe(true)
    expect(byId.get('root')).toBe(false)
    harness.watcher.dispose()
  })

  it('falls back to the Session id when the Host publishes no title', () => {
    const harness = setup()
    harness.sessions.publish({ 'session-1': { running: true } })
    harness.sessions.publish({ 'session-1': { running: false, displayTitle: '' } })
    expect(harness.records[0]!.title).toBe('session-1')
    harness.watcher.dispose()
  })

  it('survives a listing read that throws', () => {
    const ctx = {
      sessions: {
        list: {
          getSnapshot: () => {
            throw new Error('transport down')
          },
          subscribe: () => () => undefined,
        },
        binding: () => undefined,
      },
    } as unknown as Context
    expect(() => watchTurns(ctx, { onTurnEnd: () => undefined })).not.toThrow()
  })

  it('stops reporting after dispose and reports running counts meanwhile', () => {
    const harness = setup()
    harness.sessions.publish({ a: { running: true }, b: { running: false } })
    expect(harness.watcher.runningCount()).toBe(1)
    harness.watcher.dispose()
    expect(harness.watcher.runningCount()).toBe(0)
    harness.sessions.publish({ a: { running: false } })
    expect(harness.records).toEqual([])
  })
})

describe('classifyReason', () => {
  it('maps every shipped reason kind', () => {
    expect(classifyReason('completed')).toBe('completed')
    expect(classifyReason('error')).toBe('failed')
    expect(classifyReason('blocked')).toBe('failed')
    expect(classifyReason('aborted')).toBe('aborted')
    expect(classifyReason('interrupted')).toBe('aborted')
    expect(classifyReason('forked')).toBe('aborted')
    expect(classifyReason('max-tokens')).toBe('limited')
  })

  it('treats an absent or unknown kind as unknown rather than as a failure', () => {
    expect(classifyReason(undefined)).toBe('unknown')
    expect(classifyReason('some-future-reason')).toBe('unknown')
  })
})
