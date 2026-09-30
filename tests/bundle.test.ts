/**
 * Build-artifact smoke tests.
 *
 * These load the *published* files, not the sources: the CommonJS wrapper is
 * executed exactly as the browser executes it, with the module table stubbed out.
 * What is being pinned is what a source-level test cannot see — the
 * ModuleLoader registration, the requirement that every `require(...)` in the
 * bundle is a Web baseline word, the inert fallback when one of those words is
 * missing, and the Host schema's ability to accept a good config and refuse a
 * bad one.
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

/** Baseline words the shell's module table provides to every dynamic bundle. */
const BASELINE = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
])

/** One captured `load(...)` registration. */
interface Registration {
  id: string
  chunk?: string
  factory: (require: (specifier: string) => unknown) => Record<string, unknown>
}

/** One node of a Schemastery `toJSON()` reference table. */
interface SchemaNode {
  type?: string
  meta?: { volatile?: boolean; default?: unknown }
  dict?: Record<string, number | string>
}

/** A module-table stand-in that answers any property with a constructor-capable function. */
function anyModule(): Record<string, unknown> {
  return new Proxy(
    {},
    {
      get: () => function StandIn() {},
    },
  )
}

/** Execute the client bundle and return the registrations it submitted. */
function loadClientBundle(): Registration[] {
  const code = readFileSync('lib/client.js', 'utf8')
  const registrations: Registration[] = []
  const window = { __ModuleLoader__: { load: (registration: Registration) => registrations.push(registration) } }
  // The bundle's only top-level statement is the registration call; `window` is a
  // parameter so the host global is never touched.
  const evaluate = new Function('window', 'console', code) as (w: unknown, c: Console) => void
  evaluate(window, console)
  return registrations
}

describe('lib/client.js', () => {
  it('registers itself once under the package name', () => {
    const registrations = loadClientBundle()
    expect(registrations).toHaveLength(1)
    expect(registrations[0]!.id).toBe('dsh-your-turn')
  })

  it('materialises a Cordis plugin module and requires only baseline words', () => {
    const required: string[] = []
    const factory = loadClientBundle()[0]!.factory
    const exports = factory((specifier: string) => {
      required.push(specifier)
      return anyModule()
    })

    expect(typeof exports.apply).toBe('function')
    expect(exports.name).toBe('dsh-your-turn')
    expect(exports.inject).toEqual(['slots', 'locale', 'sessions', 'configForms'])
    expect([...new Set(required)].sort()).toEqual([
      '@deepseek-ai/dsh-client-ui-primitives',
      'react',
      'react/jsx-runtime',
    ])
    for (const specifier of required) expect(BASELINE.has(specifier), specifier).toBe(true)
  })

  it('degrades to an inert module instead of breaking the page when a platform word is missing', () => {
    const factory = loadClientBundle()[0]!.factory
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const exports = factory((specifier: string) => {
      if (specifier === '@deepseek-ai/dsh-client-ui-primitives') throw new Error('missed the module table')
      return anyModule()
    })

    expect(exports.name).toBe('dsh-your-turn')
    expect(exports.inject).toEqual([])
    expect(() => (exports.apply as () => void)()).not.toThrow()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('holds no relative or Node-builtin require', () => {
    const code = readFileSync('lib/client.js', 'utf8')
    const specifiers = [...code.matchAll(/\brequire\(\s*["']([^"']+)["']\s*\)/g)].map((match) => match[1]!)
    expect(specifiers.length).toBeGreaterThan(0)
    for (const specifier of specifiers) {
      expect(specifier.startsWith('.') || specifier.startsWith('/'), specifier).toBe(false)
      expect(specifier.startsWith('node:'), specifier).toBe(false)
    }
  })
})

describe('lib/index.js', () => {
  it('exposes the plugin name, a Standard Schema Config, and an apply function', async () => {
    const host = (await import('../lib/index.js')) as unknown as {
      name: string
      Config: { (value: unknown): Record<string, unknown>; toJSON(): { dict: Record<string, unknown> } }
      apply: (ctx: unknown) => void
    }
    expect(host.name).toBe('dsh-your-turn')
    expect(typeof host.Config).toBe('function')
    expect(typeof host.Config.toJSON).toBe('function')
    expect(typeof host.apply).toBe('function')
  })

  it('publishes every field of the configuration to the settings document', async () => {
    const { Config } = (await import('../lib/index.js')) as unknown as {
      Config: { toJSON(): { refs: Record<string, SchemaNode> } }
    }
    const shape = Config.toJSON()
    // `toJSON()` is a reference table: the root object node points at one node
    // per field. `dsh-settings` projects exactly the volatile ones, so the
    // invariant that matters is "17 fields, every one volatile".
    const root = Object.values(shape.refs).find((node) => node.type === 'object' && node.dict !== undefined)
    expect(root?.dict).toBeDefined()
    const fields = root!.dict!
    expect(Object.keys(fields).sort()).toEqual([
      'autoDismissSeconds',
      'enabled',
      'errorSoundPreset',
      'flashTitle',
      'includeSubagents',
      'minTurnSeconds',
      'muteAll',
      'notifyOn',
      'onlyWhenUnfocused',
      'quietHoursEnabled',
      'quietHoursEnd',
      'quietHoursStart',
      'soundEnabled',
      'soundPreset',
      'surface',
      'systemNotification',
      'volume',
    ])
    for (const [field, reference] of Object.entries(fields)) {
      expect(shape.refs[String(reference)]?.meta?.volatile, field).toBe(true)
    }
  })

  it('resolves defaults and refuses an out-of-range value', async () => {
    const { Config } = (await import('../lib/index.js')) as unknown as {
      Config: (value: unknown) => Record<string, unknown>
    }
    const read = (resolved: Record<string, unknown>, field: string): unknown => {
      const value = resolved[field] as { get?: () => unknown } | undefined
      return typeof value?.get === 'function' ? value.get() : value
    }

    const defaults = Config({})
    expect(read(defaults, 'volume')).toBe(70)
    expect(read(defaults, 'soundPreset')).toBe('chime')
    expect(read(defaults, 'errorSoundPreset')).toBe('alert')
    expect(read(defaults, 'surface')).toBe('modal')

    const partial = Config({ volume: 5, surface: 'toast' })
    expect(read(partial, 'volume')).toBe(5)
    expect(read(partial, 'surface')).toBe('toast')
    expect(read(partial, 'soundPreset')).toBe('chime')

    expect(() => Config({ volume: 500 })).toThrow()
    expect(() => Config({ surface: 'hologram' })).toThrow()
  })

  it('asks the settings service not to advertise an auto-generated page', async () => {
    const { apply } = (await import('../lib/index.js')) as unknown as { apply: (ctx: unknown) => void }
    const configure = vi.fn(() => () => undefined)
    const effect = vi.fn((factory: () => unknown) => factory())
    const fiber = { marker: 'plugin-fiber' }
    const child = { settings: { configure }, effect }
    const ctx = {
      fiber,
      inject: (services: string[], callback: (child: unknown) => void) => {
        expect(services).toEqual(['settings'])
        callback(child)
      },
    }

    apply(ctx)
    expect(configure).toHaveBeenCalledWith({ auto: false }, fiber)
    expect(effect).toHaveBeenCalledTimes(1)
  })

  it('loads without a settings service at all', async () => {
    const { apply } = (await import('../lib/index.js')) as unknown as { apply: (ctx: unknown) => void }
    // `ctx.inject` never fires its callback when the service is absent.
    expect(() => apply({ fiber: {}, inject: () => undefined })).not.toThrow()
  })
})
