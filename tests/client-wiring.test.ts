/**
 * @vitest-environment jsdom
 *
 * Source-face integration: the real client entry, activated against a stand-in
 * for the browser's module table and a stand-in Cordis context.
 *
 * The host-provided UI primitives are replaced by a stand-in — in a real page
 * they arrive from the shell's module table, never from this package — while
 * everything this plugin owns (the entry, the watcher, the notifier, the
 * settings controller, the stylesheet) runs as shipped. The assertions are about
 * externally visible effects: what got registered where, what landed in the DOM,
 * and whether a running-flag edge actually reaches the reminder queue.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => {
  /** Faithful-enough stand-in for the shipped staging model. */
  class SettingsFormModel {
    constructor(
      private readonly scope: {
        getSnapshot(): { status: string; value?: unknown; revision?: number; writable: boolean }
        subscribe(listener: () => void): () => void
      },
      private readonly specs: readonly { field: string }[],
    ) {}

    shell(): {
      available: boolean
      writable: boolean
      dirty: boolean
      invalid: boolean
      saving: boolean
      failed: boolean
    } {
      const snapshot = this.scope.getSnapshot()
      return {
        available: snapshot.status === 'ready',
        writable: snapshot.writable,
        dirty: false,
        invalid: false,
        saving: false,
        failed: false,
      }
    }

    field(name: string): { text: string; overridden: boolean; invalid: boolean } {
      const value = (this.scope.getSnapshot().value ?? {}) as Record<string, unknown>
      const raw = value[name]
      return { text: raw === undefined ? '' : String(raw), overridden: false, invalid: false }
    }

    bind<S>(project: () => S): { getSnapshot(): S; subscribe(listener: () => void): () => void } {
      let cached = project()
      return {
        getSnapshot: () => cached,
        subscribe: (listener: () => void) =>
          this.scope.subscribe(() => {
            cached = project()
            listener()
          }),
      }
    }

    actions(): { edit: () => void; resetField: () => void; save: () => void; discard: () => void } {
      return {
        edit: () => undefined,
        resetField: () => undefined,
        save: () => undefined,
        discard: () => undefined,
      }
    }

    dispose(): void {
      void this.specs
    }
  }

  const Null = (): null => null
  return {
    SettingsFormModel,
    SettingsForm: Null,
    SettingsPage: Null,
    SettingsValueField: Null,
    SettingsSecretField: Null,
    Switch: Null,
    Button: Null,
    Input: Null,
    Pill: Null,
    Tag: Null,
    Modal: Null,
    Toast: Null,
    SegmentedControl: Null,
    Checkbox: Null,
    Menu: Null,
    MenuItemButton: Null,
    StateDot: Null,
    DisclosureRow: Null,
    Tooltip: Null,
    HoverCard: Null,
    ConnectionIndicator: Null,
    JsonTree: Null,
    MarkdownText: Null,
    CodeBlock: Null,
  }
})

import { DICTS, NS } from '../src/client/locale.ts'
import { apply, inject, name } from '../src/client/index.tsx'
import { STYLE_ELEMENT_ID, installStyles } from '../src/client/styles.ts'
import { Notifier } from '../src/client/notifier.ts'

/** Stand-in for `ctx.sessions`. */
class FakeSessions {
  private rows: Record<string, { running?: boolean; displayTitle?: string }> = {}
  private readonly listeners = new Set<() => void>()

  readonly list = {
    getSnapshot: () => ({ ids: Object.keys(this.rows), byId: this.rows }),
    subscribe: (listener: () => void): (() => void) => {
      this.listeners.add(listener)
      return () => {
        this.listeners.delete(listener)
      }
    },
  }

  binding(): undefined {
    return undefined
  }

  publish(rows: Record<string, { running?: boolean; displayTitle?: string }>): void {
    this.rows = rows
    for (const listener of [...this.listeners]) listener()
  }
}

/** One captured Slot registration. */
interface Registration {
  options: { name: string; id?: string; order?: number; locale?: string; inject?: () => Record<string, unknown> }
  component: unknown
}

/** Build the stand-in context and collect everything the plugin registers. */
function makeContext(uiSession?: { sessionStatus: { getSnapshot(): ReadonlyMap<string, { pendingInteraction?: { kind: string; key: string } }>; subscribe(fn: () => void): () => void } }): {
  ctx: Context
  registrations: Registration[]
  locales: { ns: string; dicts: unknown }[]
  sessions: FakeSessions
  runDisposers(): void
} {
  const registrations: Registration[] = []
  const locales: { ns: string; dicts: unknown }[] = []
  const disposers: (() => void)[] = []
  const sessions = new FakeSessions()

  const form = {
    getSnapshot: () => ({
      status: 'ready' as const,
      value: { enabled: true, volume: 40 },
      base: {},
      user: { volume: 40 },
      revision: 3,
      writable: true,
      mode: 'host' as const,
    }),
    subscribe: () => () => undefined,
    mutate: async () => true,
    set: async () => true,
    unset: async () => true,
  }

  const ctx = {
    effect: (factory: () => unknown) => {
      const disposer = factory()
      if (typeof disposer === 'function') disposers.push(disposer as () => void)
      return disposer
    },
    locale: {
      register: (ns: string, dicts: unknown) => {
        locales.push({ ns, dicts })
        return () => undefined
      },
      bind: () => (key: string) => key,
    },
    configForms: { get: () => form },
    sessions,
    get: (service: string) => service === 'uiSession' ? uiSession : service === 'sessions' ? sessions : undefined,
    inject: (_services: unknown, callback: (child: Context) => void) => { if (uiSession) callback(ctx); return () => undefined },
    slots: {
      inject: (_slotName: string, callback: () => unknown) => callback(),
      register: (options: Registration['options'], component: unknown) => {
        registrations.push({ options, component })
        return () => undefined
      },
    },
  } as unknown as Context

  return {
    ctx,
    registrations,
    locales,
    sessions,
    runDisposers: () => {
      for (const disposer of [...disposers].reverse()) disposer()
      disposers.length = 0
    },
  }
}

beforeEach(() => {
  document.head.innerHTML = ''
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('client entry', () => {
  it('declares its Cordis service dependencies and its name', () => {
    expect(name).toBe('@wu5/dsh-your-turn')
    expect([...inject]).toEqual(['slots', 'locale', 'sessions', 'configForms'])
  })

  it('registers both dictionaries under its own namespace', () => {
    const harness = makeContext()
    apply(harness.ctx)
    expect(harness.locales).toEqual([{ ns: NS, dicts: DICTS }])
    harness.runDisposers()
  })

  it('installs one owned stylesheet, tagged for hot-reload bookkeeping, and removes it on dispose', () => {
    const harness = makeContext()
    apply(harness.ctx)
    const selector = `style[data-plugin-css="${STYLE_ELEMENT_ID}"]`
    const element = document.head.querySelector(selector)
    expect(element).not.toBeNull()
    expect(element?.textContent).toContain('.yt-reminder')
    expect(element?.textContent).toContain('.yt-sound')
    // Ownership, not decoration: `@deepseek-ai/dsh-client-modules` adopts every
    // untagged `style:not([data-plugin])` via `claimStyles`, then deletes it via
    // that adopter's `removeOwnedStyles`. An untagged sheet is therefore stolen
    // by an unrelated plugin and pruned when that plugin reloads.
    expect(element?.getAttribute('data-plugin')).toBe('@wu5/dsh-your-turn')
    harness.runDisposers()
    expect(document.head.querySelector(selector)).toBeNull()
  })

  it('keeps the sheet alive when a superseded instance disposes after a newer install', () => {
    const harness = makeContext()
    apply(harness.ctx)
    const selector = `style[data-plugin-css="${STYLE_ELEMENT_ID}"]`

    // A second activation adopts the same document-wide element, exactly as a hot
    // reload does. Its disposer must be the one that removes the sheet.
    const reloaded = installStyles()
    expect(document.head.querySelectorAll(selector)).toHaveLength(1)

    // The older instance drains last. Before the ownership guard this removed the
    // element the newer instance was still serving, silently unstyling the page.
    harness.runDisposers()
    const element = document.head.querySelector<HTMLStyleElement>(selector)
    expect(element).not.toBeNull()
    expect(element?.textContent).toContain('.yt-sound')

    reloaded()
    expect(document.head.querySelector(selector)).toBeNull()
  })

  it('self-heals a sheet an older build installed without the ownership marker', () => {
    // Reproduce the pre-fix artifact: a tagged-for-dedup but unowned style element.
    document.head.innerHTML = `<style data-plugin-css="${STYLE_ELEMENT_ID}">/* stale */</style>`
    const dispose = installStyles()
    const element = document.head.querySelector<HTMLStyleElement>(`style[data-plugin-css="${STYLE_ELEMENT_ID}"]`)
    expect(element?.getAttribute('data-plugin')).toBe('@wu5/dsh-your-turn')
    expect(element?.textContent).toContain('.yt-sound')
    dispose()
  })

  it('registers the reminder overlay, the settings page and the sidebar-foot switch, and nothing else', () => {
    const harness = makeContext()
    apply(harness.ctx)
    expect(harness.registrations.map((entry) => entry.options.name)).toEqual(['shell.overlay', 'settings.section', 'sidebar.footer.action'])

    const [overlay, section, sound] = harness.registrations
    expect(overlay!.options.id).toBe('dsh-your-turn')
    expect(overlay!.options.locale).toBe(NS)
    expect(section!.options.id).toBe('your-turn')
    expect(section!.options.locale).toBe(NS)
    expect(section!.options.order).toBe(60)
    // The foot seat is shared with the remote-web-ui phone trigger; this
    // plugin's entry is the one beside it.
    expect(sound!.options.id).toBe('dsh-your-turn/sound')
    expect(sound!.options.locale).toBe(NS)
    expect(sound!.options.order).toBe(10)
    expect(typeof overlay!.component).toBe('function')
    expect(typeof section!.component).toBe('function')
    expect(typeof sound!.component).toBe('function')
    harness.runDisposers()
  })

  it('injects one notifier into each surface this plugin mounts', () => {
    const harness = makeContext()
    apply(harness.ctx)
    const faces = harness.registrations.map((entry) => entry.options.inject?.() as { notifier: Notifier } | undefined)
    for (const face of faces) expect(face?.notifier).toBeDefined()
    expect(faces[1]?.notifier).toBe(faces[0]?.notifier)
    expect(faces[2]?.notifier).toBe(faces[0]?.notifier)
    harness.runDisposers()
  })

  it('wires a running-flag edge through to a reminder in the queue', () => {
    vi.useFakeTimers()
    const harness = makeContext()
    apply(harness.ctx)
    const notifier = (harness.registrations[0]!.options.inject?.() as { notifier: Notifier }).notifier

    harness.sessions.publish({ 'session-a': { running: true, displayTitle: 'Refactor auth' } })
    expect(notifier.state.getSnapshot().reminders).toEqual([])
    vi.advanceTimersByTime(9_000)
    harness.sessions.publish({ 'session-a': { running: false, displayTitle: 'Refactor auth' } })

    const reminders = notifier.state.getSnapshot().reminders
    expect(reminders).toHaveLength(1)
    expect(reminders[0]).toMatchObject({
      sessionId: 'session-a',
      title: 'Refactor auth',
      outcome: 'unknown',
      durationMs: 9_000,
    })
    harness.runDisposers()
  })

  it('makes the open-session action a logged no-op without Workspace navigation', () => {
    const harness = makeContext()
    apply(harness.ctx)
    const action = (harness.registrations[0]!.options.inject?.() as { openSession: (id: string) => void })
      .openSession
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    expect(() => action('session-a')).not.toThrow()
    expect(info).toHaveBeenCalled()
    info.mockRestore()
    harness.runDisposers()
  })

  it('wires pending questions through the optional service and unsubscribes on teardown', () => {
    const listeners = new Set<() => void>()
    let snapshot = new Map<string, { pendingInteraction?: { kind: string; key: string } }>()
    const uiSession = { sessionStatus: {
      getSnapshot: () => snapshot,
      subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn) },
    } }
    const harness = makeContext(uiSession)
    const consider = vi.spyOn(Notifier.prototype, 'considerQuestion').mockImplementation(() => {})
    apply(harness.ctx)
    snapshot = new Map([['a', { pendingInteraction: { kind: 'question', key: 'one' } }]])
    for (const fn of listeners) fn()
    for (const fn of listeners) fn()
    expect(consider).toHaveBeenCalledOnce()
    expect(consider).toHaveBeenCalledWith({ sessionId: 'a', key: 'one', subagent: false })
    harness.runDisposers()
    expect(listeners.size).toBe(0)
    consider.mockRestore()
  })

  it('stops watching turns and dismisses the queue on dispose', () => {
    vi.useFakeTimers()
    const harness = makeContext()
    apply(harness.ctx)
    const notifier = (harness.registrations[0]!.options.inject?.() as { notifier: Notifier }).notifier
    harness.sessions.publish({ 'session-a': { running: true } })
    harness.sessions.publish({ 'session-a': { running: false } })
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)

    harness.runDisposers()
    // The watcher is detached: a later edge reaches nothing.
    harness.sessions.publish({ 'session-a': { running: true } })
    harness.sessions.publish({ 'session-a': { running: false } })
    expect(notifier.state.getSnapshot().reminders).toHaveLength(1)
  })
})
