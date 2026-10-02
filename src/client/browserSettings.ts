/** Remote settings use this browser's storage, never the loopback-only Host write API. */
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import { CONFIG_DEFAULTS, normalizeConfig, type YourTurnConfig } from '../shared/settings.ts'
import { Observable } from './observable.ts'

export const BROWSER_SETTINGS_KEY = 'dsh-your-turn/settings/v1'
type Snapshot = ReturnType<ConfigForm<Partial<YourTurnConfig>>['getSnapshot']>
type Ops = Parameters<ConfigForm<Partial<YourTurnConfig>>['mutate']>[0]

export class BrowserSettings implements ConfigForm<Partial<YourTurnConfig>> {
  private readonly state: Observable<Snapshot>
  constructor() {
    let user: Partial<YourTurnConfig> = {}
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(BROWSER_SETTINGS_KEY) ?? '{}')
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const normalized = normalizeConfig(parsed)
        for (const key of Object.keys(CONFIG_DEFAULTS) as (keyof YourTurnConfig)[]) {
          if (Object.hasOwn(parsed, key)) Object.assign(user, { [key]: normalized[key] })
        }
      }
    } catch { /* Corrupt or inaccessible storage falls back to defaults. */ }
    this.state = new Observable<Snapshot>({ status: 'ready', value: normalizeConfig(user), base: CONFIG_DEFAULTS, user, revision: 0, writable: true, mode: 'memory' })
  }
  getSnapshot = (): Snapshot => this.state.getSnapshot()
  subscribe = (listener: () => void): (() => void) => this.state.subscribe(listener)
  async mutate(ops: Ops, expectedRevision?: number): Promise<boolean> {
    const current = this.getSnapshot()
    if (expectedRevision !== undefined && current.revision !== expectedRevision) return false
    const user = { ...(current.user as Partial<YourTurnConfig>) } as Record<string, unknown>
    for (const op of ops) {
      const field = op.path[0]
      if (op.path.length !== 1 || typeof field !== 'string' || !Object.hasOwn(CONFIG_DEFAULTS, field)) return false
      if (op.op === 'set') user[field] = op.value
      else if (op.op === 'unset') delete user[field]
      else return false
    }
    const normalized = normalizeConfig(user)
    for (const op of ops) {
      if (op.op === 'set' && normalized[op.path[0] as keyof YourTurnConfig] !== op.value) return false
    }
    const safeUser = Object.fromEntries(Object.keys(user).map((field) => [field, normalized[field as keyof YourTurnConfig]]))
    // Never report durable success if storage refused the write; the form keeps its draft.
    try { localStorage.setItem(BROWSER_SETTINGS_KEY, JSON.stringify(safeUser)) } catch { return false }
    this.state.set({ ...current, user: safeUser, value: normalized, revision: (current.revision ?? 0) + 1 })
    return true
  }
  set = (field: string, value: unknown): Promise<boolean> => this.mutate([{ op: 'set', path: [field], value }])
  unset = (field: string): Promise<boolean> => this.mutate([{ op: 'unset', path: [field] }])
}

/** Keep the Host form on local pages; select a distinct browser form only in explicit memory mode. */
export class AdaptiveSettings implements ConfigForm<Partial<YourTurnConfig>> {
  private readonly browser = new BrowserSettings()
  constructor(private readonly host: ConfigForm<Partial<YourTurnConfig>>) {}
  private active(): ConfigForm<Partial<YourTurnConfig>> {
    return this.host.getSnapshot().mode === 'memory' ? this.browser : this.host
  }
  getSnapshot = (): Snapshot => this.active().getSnapshot()
  subscribe = (listener: () => void): (() => void) => {
    const host = this.host.subscribe(listener)
    const browser = this.browser.subscribe(listener)
    return () => { host(); browser() }
  }
  mutate = (ops: Ops, expectedRevision?: number): Promise<boolean> => this.active().mutate(ops, expectedRevision)
  set = (field: string, value: unknown): Promise<boolean> => this.active().set(field, value)
  unset = (field: string): Promise<boolean> => this.active().unset(field)
}
