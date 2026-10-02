/** Observe official pending question cards; a running agent need not go idle to ask. */
import type { Context } from '@deepseek-ai/cordis'

export interface QuestionRecord {
  sessionId: string
  key: string
  subagent: boolean
}

interface QuestionStatus {
  pendingInteraction?: { kind?: string; key?: string; sessionId?: string; review?: unknown }
}

export function watchQuestions(ctx: Context, onQuestion: (record: QuestionRecord) => void): () => void {
  const service = ctx.get('uiSession' as never) as {
    sessionStatus: {
      getSnapshot(): ReadonlyMap<string, QuestionStatus>
      subscribe(listener: () => void): () => void
    }
  } | undefined
  if (service?.sessionStatus === undefined) return () => undefined
  const seen = new Set<string>()
  const observe = (): void => {
    for (const [sessionId, status] of service.sessionStatus.getSnapshot()) {
      const question = status.pendingInteraction
      if (question?.kind !== 'question' || typeof question.key !== 'string' || question.review !== undefined) continue
      const identity = `${sessionId}:${question.key}`
      if (seen.has(identity)) continue
      seen.add(identity)
      // Retain identities across hide/reopen without growing for the entire page lifetime.
      if (seen.size > 512) seen.delete(seen.values().next().value!)
      const sessions = ctx.get('sessions' as never) as {
        list: { getSnapshot(): { byId: Record<string, { origin?: string; parentId?: string } | undefined> } }
      } | undefined
      const row = sessions?.list.getSnapshot().byId[sessionId]
      try {
        onQuestion({ sessionId, key: question.key, subagent: row?.origin === 'subagent' || row?.parentId !== undefined })
      } catch (error) {
        console.error('[dsh-your-turn] question reminder failed', error)
      }
    }
  }
  const unsubscribe = service.sessionStatus.subscribe(observe)
  observe()
  return () => { unsubscribe(); seen.clear() }
}
