/**
 * The browser's view of the plugin's configuration.
 *
 * The Host half owns the settings section; this page reaches it through
 * `ctx.configForms`, the settings domain's shared per-entry form. That service
 * already handles the describe mirror, revision fencing, and write recovery, so
 * this module only does three things: resolve a partial or absent section into a
 * complete configuration, publish it as a snapshot the render path can read, and
 * expose the form itself to the settings page's staging model.
 *
 * @module dsh-your-turn/client/settings
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ConfigForm, ConfigForms } from '@deepseek-ai/dsh-client-ui-settings/client'
import { ENTRY_ID, normalizeConfig, type YourTurnConfig } from '../shared/settings.ts'
import { Observable } from './observable.ts'
import { AdaptiveSettings } from './browserSettings.ts'

/** State of this page's bind to the Host settings section. */
export type SettingsStatus = 'loading' | 'ready' | 'unavailable'

/** What the render path reads. */
export interface ResolvedSettings {
  /** Complete configuration; compiled-in defaults fill anything the Host omits. */
  config: YourTurnConfig
  /** Whether the Host serves this namespace to this page. */
  status: SettingsStatus
  /** Whether the Host document accepts writes from this page. */
  writable: boolean
  /** Remote pages save per-browser preferences instead of calling Host settings. */
  storage?: 'host' | 'browser'
}

/**
 * Binds the plugin's settings section and publishes a resolved configuration.
 *
 * `configForms` is one of this plugin's declared Cordis dependencies, so it is
 * present whenever `apply` runs; the guard below covers a composition whose
 * settings service was replaced by something without the form API, which is a
 * broken composition rather than an unsupported one.
 *
 * The official settings wire is loopback-only. An explicitly memory-mode remote
 * page uses a separate browser-local form; inaccessible Host-mode forms stay
 * unavailable/read-only rather than silently masking a Host failure.
 */
export class SettingsController {
  /** Resolved configuration; the single source the reminder path reads. */
  readonly snapshot: Observable<ResolvedSettings>

  /** The Host-backed section form, when this composition provides one. */
  readonly form: ConfigForm<Partial<YourTurnConfig>> | undefined

  private readonly unsubscribe: (() => void) | undefined

  /**
   * @param ctx - Client Cordis context.
   */
  constructor(ctx: Context) {
    const forms = (ctx as { configForms?: ConfigForms }).configForms
    if (forms === undefined || typeof forms.get !== 'function') {
      this.form = undefined
      this.unsubscribe = undefined
      this.snapshot = new Observable<ResolvedSettings>({
        config: normalizeConfig(undefined),
        status: 'unavailable',
        writable: false,
      })
      return
    }
    const form = new AdaptiveSettings(forms.get<Partial<YourTurnConfig>>(ENTRY_ID))
    this.form = form
    const recompute = (): void => this.recompute(form)
    this.snapshot = new Observable<ResolvedSettings>(read(form))
    this.unsubscribe = form.subscribe(recompute)
    recompute()
  }

  /** @returns the current configuration. */
  get config(): YourTurnConfig {
    return this.snapshot.getSnapshot().config
  }

  /** Release the form subscription. */
  dispose(): void {
    this.unsubscribe?.()
  }

  /** Republish from the form's latest accepted section. */
  private recompute(form: ConfigForm<Partial<YourTurnConfig>>): void {
    this.snapshot.set(read(form))
  }
}

/**
 * Read one form snapshot as resolved settings.
 * @param form - the entry's shared form.
 * @returns the resolved view.
 */
function read(form: ConfigForm<Partial<YourTurnConfig>>): ResolvedSettings {
  let state
  try {
    state = form.getSnapshot()
  } catch (error) {
    console.error('[dsh-your-turn] settings read failed', error)
    return { config: normalizeConfig(undefined), status: 'unavailable', writable: false }
  }
  return {
    config: normalizeConfig(state.value),
    status: state.status,
    writable: state.writable,
    storage: state.mode === 'memory' ? 'browser' : 'host',
  }
}
