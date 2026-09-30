/**
 * Small pure helpers shared by the reminder surfaces.
 *
 * @module dsh-your-turn/client/presentation
 */

import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type { TurnOutcome } from '../shared/settings.ts'

/** Translation key of the headline for one outcome. */
export type HeadlineKey =
  | 'headline.completed'
  | 'headline.failed'
  | 'headline.aborted'
  | 'headline.limited'
  | 'headline.unknown'

/** Translation keys of the duration phrasings. */
export type DurationKey = 'duration.seconds' | 'duration.minutes' | 'duration.minutesSeconds'

/**
 * @param outcome - classified turn outcome.
 * @returns the dictionary key naming it.
 */
export function headlineKey(outcome: TurnOutcome): HeadlineKey {
  switch (outcome) {
    case 'completed':
      return 'headline.completed'
    case 'failed':
      return 'headline.failed'
    case 'aborted':
      return 'headline.aborted'
    case 'limited':
      return 'headline.limited'
    default:
      return 'headline.unknown'
  }
}

/**
 * Render a turn duration in whole seconds, minutes, or minutes and seconds.
 *
 * The key domain is a parameter so the namespace-bound `t` seat stays assignable:
 * `Translate<K>` is contravariant in `K`, and a namespace-bound translate accepts
 * a narrower key union than the unbound alias does.
 *
 * @param t - namespace-bound translate.
 * @param ms - observed duration in milliseconds.
 * @returns localized duration text.
 */
export function formatDuration<K extends DurationKey>(t: Translate<K>, ms: number): string {
  // The generic keeps the caller's namespace-bound `t` assignable; inside, the
  // key domain is exactly the duration phrasings this function chooses between.
  const translate = t as Translate<DurationKey>
  const total = Math.max(0, Math.round(ms / 1000))
  if (total < 60) return translate('duration.seconds', { n: total })
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  if (seconds === 0) return translate('duration.minutes', { n: minutes })
  return translate('duration.minutesSeconds', { m: minutes, s: seconds })
}

/**
 * Last path segment of a Windows or POSIX path.
 *
 * @param path - working directory from the Session list.
 * @returns the folder name, or the input when it has no separator.
 */
export function basename(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '')
  const index = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  return index === -1 ? trimmed : trimmed.slice(index + 1)
}
