/**
 * End-to-end check of the SHIPPED bundle (`lib/client.js`), not the source.
 *
 * Loads the real CommonJS factory through a stand-in `window.__ModuleLoader__`,
 * runs `apply()` against a minimal Cordis-like context, and reproduces the
 * `@deepseek-ai/dsh-client-modules` style bookkeeping that used to delete this
 * plugin's stylesheet mid-session.
 *
 * Run: node audit/verify-bundle-styles.mjs
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { JSDOM } from 'jsdom'

const require = createRequire(import.meta.url)
const BUNDLE = 'D:/Project/Code/dsh-your-turn/lib/client.js'
const PACKAGE_ID = '@wu5/dsh-your-turn'

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === '' ? '' : ` — ${detail}`}`)
}

/** Load the shipped bundle and return its exports. */
function loadBundle(window) {
  let captured = null
  window.__ModuleLoader__ = {
    load: descriptor => {
      captured = descriptor
    },
  }
  // The bundle's factory only needs the DOM globals and its three externals.
  window.eval(readFileSync(BUNDLE, 'utf8'))
  if (captured === null) throw new Error('bundle did not register a factory')
  if (captured.id !== PACKAGE_ID) throw new Error(`unexpected bundle id: ${captured.id}`)

  const shim = id => {
    if (id === 'react' || id === 'react/jsx-runtime') return require(id)
    if (id === '@deepseek-ai/dsh-client-ui-primitives') {
      // `apply()` constructs only SettingsFormModel; the rest are rendered later,
      // and this harness never mounts React.
      class SettingsFormModel {
        constructor() {}
        subscribe() {
          return () => undefined
        }
        getState() {
          return { status: 'ready', value: {}, base: {}, user: {}, revision: 0, writable: true, mode: 'host' }
        }
        edit() {
          return undefined
        }
      }
      const Null = () => null
      const table = { SettingsFormModel }
      return new Proxy(
        { __esModule: true },
        { get: (target, key) => (key === '__esModule' ? true : (target[key] ??= table[key] ?? Null)) },
      )
    }
    throw new Error(`unexpected require: ${id}`)
  }
  return captured.factory(shim)
}

/** Minimal Cordis-like context: `effect` runs the factory and keeps its disposer. */
function makeContext() {
  const disposers = []
  const registrations = []
  const form = {
    getSnapshot: () => ({
      status: 'ready',
      value: { enabled: true, volume: 40 },
      base: {},
      user: { volume: 40 },
      revision: 3,
      writable: true,
      mode: 'host',
    }),
    subscribe: () => () => undefined,
    mutate: async () => true,
    set: async () => true,
    unset: async () => true,
    edit: async () => true,
  }
  const slots = {
    inject: (_name, callback) => callback(),
    register: (options, component) => {
      registrations.push({ options, component })
      return () => undefined
    },
  }
  const sessions = {
    list: { getSnapshot: () => ({ ids: [], byId: {} }), subscribe: () => () => undefined },
    binding: () => undefined,
  }
  const ctx = {
    logger: { info() {}, warn() {}, error() {} },
    effect: factory => {
      const disposer = factory()
      if (typeof disposer === 'function') disposers.push(disposer)
      return disposer
    },
    locale: { register: () => () => undefined, bind: () => key => key },
    get: service => (service === 'sessions' ? sessions : undefined),
    inject: () => () => undefined,
    slots,
    sessions,
    configForms: {},
    on: () => () => undefined,
  }
  return {
    ctx,
    registrations,
    runDisposers: () => {
      for (const disposer of [...disposers].reverse()) disposer()
      disposers.length = 0
    },
  }
}

// ------------------------------------------------- the platform's bookkeeping
const claimStyles = (doc, id) => {
  for (const el of doc.querySelectorAll('style:not([data-plugin])')) el.setAttribute('data-plugin', id)
  return [...doc.querySelectorAll(`style[data-plugin=${JSON.stringify(id)}]`)].map(
    el => el.getAttribute('data-plugin-css') ?? id,
  )
}
const removeOwnedStyles = (doc, id) => {
  for (const el of doc.querySelectorAll('style[data-plugin]')) {
    if (el.getAttribute('data-plugin') === id) el.remove()
  }
}

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>')
const { window } = dom
globalThis.window = window
globalThis.document = window.document
globalThis.HTMLElement = window.HTMLElement
globalThis.EventSource = class {
  addEventListener() {}
  close() {}
}

const doc = window.document
const exports = loadBundle(window)
check('bundle factory returns the plugin module', typeof exports.apply === 'function' && exports.name === PACKAGE_ID)

const harness = makeContext()
exports.apply(harness.ctx)

const SELECTOR = 'style[data-plugin-css="dsh-your-turn"]'
const element = doc.head.querySelector(SELECTOR)
check('apply() installs the stylesheet', element !== null)
check('the sheet carries package ownership', element.getAttribute('data-plugin') === PACKAGE_ID, `data-plugin=${element.getAttribute('data-plugin')}`)
check('the sheet still carries the dedup key', element.getAttribute('data-plugin-css') === 'dsh-your-turn')
check('the sheet carries the real CSS', element.textContent.includes('.yt-sound__pending') && element.textContent.includes('.yt-settings'))
check('the toggle anchors its own pending panel', /\.yt-sound \{[^}]*position: relative/.test(element.textContent))

// An unrelated plugin materializes and reloads: it must not touch our sheet.
claimStyles(doc, '@linxin666/dsh-remote-web-ui')
removeOwnedStyles(doc, '@linxin666/dsh-remote-web-ui')
check('an unrelated plugin reload leaves the sheet in place', doc.head.querySelector(SELECTOR) !== null)

// The platform's own hot-replace step for THIS package: teardown, prune, re-import.
removeOwnedStyles(doc, PACKAGE_ID)
check('the platform prunes owned styles on reload (expected)', doc.head.querySelector(SELECTOR) === null)
const second = makeContext()
exports.apply(second.ctx)
check('the fresh apply re-installs the sheet', doc.head.querySelector(SELECTOR) !== null)

// Now the stale-teardown ordering: the OLD instance drains after the new one.
harness.runDisposers()
check('a stale disposer cannot strip the live sheet', doc.head.querySelector(SELECTOR) !== null)
second.runDisposers()
check('the live disposer removes the sheet', doc.head.querySelector(SELECTOR) === null)

// The sidebar-foot surface the user saw floating must stay hidden while styled.
check(
  'the pending panel is hidden unless hovered/focused',
  /\.yt-sound__pending \{[^}]*opacity: 0/.test(element.textContent ?? readFileSync(BUNDLE, 'utf8')),
)

const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} bundle checks passed`)
process.exitCode = failed.length === 0 ? 0 : 1
