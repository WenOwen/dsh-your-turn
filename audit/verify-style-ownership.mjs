/**
 * Verifies the stylesheet-ownership contract of `src/client/styles.ts` against the
 * real browser module-system behaviour, without vitest (vitest needs to write its
 * cache dir, which this sandbox denies; node can read and print, not write).
 *
 * Run: node audit/verify-style-ownership.mjs
 */
import { JSDOM } from 'jsdom'
import { installStyles, STYLE_ELEMENT_ID, CSS } from '../src/client/styles.ts'
import { PACKAGE_NAME } from '../src/shared/settings.ts'

const SELECTOR = `style[data-plugin-css="${STYLE_ELEMENT_ID}"]`
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail === '' ? '' : ` — ${detail}`}`)
}

function freshDocument() {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>')
  return dom.window.document
}

/**
 * The shipped `@deepseek-ai/dsh-client-modules` bookkeeping, reproduced from
 * `audit/runtime/asar/dsh-client-modules/lib/client.js`:
 *   - claimStyles(id)   (:492-496) adopts EVERY `style:not([data-plugin])`.
 *   - removeOwnedStyles(id) (:194-196) removes every `style[data-plugin="<id>"]`.
 *   - a module's materialization calls claimStyles(ownerId) (:684) and its teardown
 *     calls removeOwnedStyles(ownerId) (:690, :796, :821).
 */
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

// ---------------------------------------------------------------- the old bug
{
  const doc = freshDocument()
  // What the pre-fix build installed: a sheet deduplicated by `data-plugin-css`
  // but with NO ownership marker.
  const legacy = doc.createElement('style')
  legacy.dataset.pluginCss = STYLE_ELEMENT_ID
  legacy.textContent = CSS
  doc.head.append(legacy)

  // An unrelated plugin materializes next and claims the unowned sheet.
  claimStyles(doc, '@someone/else')
  check(
    'repro: an untagged sheet is stolen by the next package to materialize',
    legacy.getAttribute('data-plugin') === '@someone/else',
    `data-plugin=${legacy.getAttribute('data-plugin')}`,
  )

  // That package reloads — and deletes what it adopted, mid-session, for good.
  removeOwnedStyles(doc, '@someone/else')
  check(
    'repro: the adopter\'s reload deletes our stylesheet (root cause of 格式错乱)',
    doc.head.querySelector(SELECTOR) === null,
    'page is left unstyled until a reload; nothing re-asserts the sheet',
  )
}

// ------------------------------------------------------------- the fix: owner
{
  const doc = freshDocument()
  const dispose = installStyles(doc)
  const element = doc.head.querySelector(SELECTOR)
  check('fix: install creates the sheet', element !== null)
  check(
    'fix: the sheet is stamped with package ownership',
    element.getAttribute('data-plugin') === PACKAGE_NAME,
    `data-plugin=${element.getAttribute('data-plugin')}`,
  )
  check('fix: the sheet carries the dedup key', element.getAttribute('data-plugin-css') === STYLE_ELEMENT_ID)
  check('fix: the sheet carries the CSS', element.textContent.includes('.yt-sound') && element.textContent.includes('.yt-settings'))

  // It can no longer be claimed by anyone else.
  claimStyles(doc, '@someone/else')
  check('fix: an unrelated package cannot claim our sheet', element.getAttribute('data-plugin') === PACKAGE_NAME)
  removeOwnedStyles(doc, '@someone/else')
  check('fix: an unrelated package\'s reload leaves our sheet in place', doc.head.querySelector(SELECTOR) !== null)

  dispose()
  check('fix: disposing the owner removes the sheet', doc.head.querySelector(SELECTOR) === null)
}

// ------------------------------------------------ the fix: stale-owner guard
{
  const doc = freshDocument()
  const first = installStyles(doc)   // instance A (superseded by the reload)
  const second = installStyles(doc)  // instance B (the live hot-reloaded fiber)
  check('fix: a re-apply adopts rather than stacks', doc.head.querySelectorAll(SELECTOR).length === 1)

  first() // A drains last, exactly as HMR's dispose ordering can do
  const survived = doc.head.querySelector(SELECTOR)
  check(
    'fix: a superseded disposer cannot strip the live sheet',
    survived !== null,
    'this is the failure mode that required a DSH restart',
  )
  check('fix: the surviving sheet is still this plugin\'s', survived.getAttribute('data-plugin') === PACKAGE_NAME)

  second()
  check('fix: the live owner\'s disposer still removes the sheet', doc.head.querySelector(SELECTOR) === null)
}

// ------------------------------------------- the fix: repairs a legacy sheet
{
  const doc = freshDocument()
  const legacy = doc.createElement('style')
  legacy.dataset.pluginCss = STYLE_ELEMENT_ID
  legacy.textContent = '/* stale build */'
  doc.head.append(legacy)

  const dispose = installStyles(doc)
  const repaired = doc.head.querySelector(SELECTOR)
  check('fix: a sheet left untagged by an older build is repaired in place', repaired === legacy && repaired.getAttribute('data-plugin') === PACKAGE_NAME)
  check('fix: repair refreshes stale CSS', repaired.textContent.includes('.yt-sound'))
  check('fix: repair does not stack a second sheet', doc.head.querySelectorAll(SELECTOR).length === 1)
  dispose()
}

// -------------------------- no document: installStyles must stay a no-op shim
{
  const dispose = installStyles(undefined)
  check('fix: no document means a no-op disposer', typeof dispose === 'function' && dispose() === undefined)
}

const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exitCode = failed.length === 0 ? 0 : 1
