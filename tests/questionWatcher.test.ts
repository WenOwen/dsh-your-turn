import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { watchQuestions, type QuestionRecord } from '../src/client/questionWatcher.ts'

describe('question watcher', () => {
  it('chimes once per actual question, not status refreshes, hide/reopen, reviews or approvals', () => {
    let snapshot = new Map<string, { pendingInteraction?: { key: string; kind: string; review?: unknown } }>()
    const listeners = new Set<() => void>()
    const service = { sessionStatus: { getSnapshot: () => snapshot, subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn) } } }
    const ctx = { get: (name: string) => name === 'uiSession' ? service : undefined } as unknown as Context
    const records: QuestionRecord[] = []
    const dispose = watchQuestions(ctx, (record) => records.push(record))
    const publish = (key: string, kind = 'question', review?: unknown) => {
      snapshot = new Map([['a', { pendingInteraction: { key, kind, review } }]])
      for (const fn of listeners) fn()
    }
    publish('one'); publish('one')
    snapshot = new Map(); for (const fn of listeners) fn()
    publish('one'); publish('review', 'question', {}); publish('approval', 'approval'); publish('plan', 'plan-review'); publish('two')
    expect(records.map((record) => record.key)).toEqual(['one', 'two'])
    dispose(); publish('three'); expect(records).toHaveLength(2)
  })
  it('handles an already-pending question once on mount, including subagent identification', () => {
    const source = { getSnapshot: () => new Map([['a', { pendingInteraction: { kind: 'question', key: 'one' } }]]), subscribe: () => () => {} }
    const ctx = { get: (name: string) => name === 'uiSession' ? { sessionStatus: source } : { list: { getSnapshot: () => ({ byId: { a: { origin: 'subagent' } } }) } } } as unknown as Context
    const records: QuestionRecord[] = []
    watchQuestions(ctx, (record) => records.push(record))()
    expect(records).toEqual([{ sessionId: 'a', key: 'one', subagent: true }])
  })
  it('is a no-op without the optional service', () => {
    expect(() => watchQuestions({ get: () => undefined } as unknown as Context, () => {})()).not.toThrow()
  })
})
