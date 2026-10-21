/**
 * @vitest-environment jsdom
 *
 * The sidebar-foot sound switch: it must show the state the settings page
 * shows, write through the settings page's own queue, draw a monochrome glyph
 * that follows the seat's rail/wide state, and stay inert when the deployment's
 * settings document refuses writes.
 */

import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, createElement } from 'react'
// The project ships React DOM without its optional type package; only the tests use createRoot.
const { createRoot } = createRequire(import.meta.url)('react-dom/client') as {
  createRoot(container: Element): { render(node: ReturnType<typeof createElement>): void; unmount(): void }
}
type Root = ReturnType<typeof createRoot>

import { Observable } from '../src/client/observable.ts'
import { SoundToggle } from '../src/client/SoundToggle.tsx'
import type { SettingsFieldState } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SettingsFormView } from '../src/client/SettingsPage.tsx'
import type { Notifier } from '../src/client/notifier.ts'

const SHELL = { available: true, writable: true, dirty: false, invalid: false, saving: false, failed: false }
const t = ((key: string) => key) as never

;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
let root: Root | undefined
afterEach(async () => {
  await act(async () => root?.unmount())
  root = undefined
  document.body.replaceChildren()
})

/** Build the projection the settings model would publish. */
function view(
  text: string,
  options: { readonly preset?: string; readonly writable?: boolean; readonly fields?: boolean } = {},
): Observable<SettingsFormView> {
  const fields: Readonly<Record<string, SettingsFieldState>> = options.fields === false
    ? {}
    : {
        soundEnabled: { text, overridden: false, invalid: false },
        soundPreset: { text: options.preset ?? 'marimba', overridden: false, invalid: false },
      }
  return new Observable<SettingsFormView>({ shell: { ...SHELL, writable: options.writable ?? true }, fields })
}

/** Mount one switch and return its pieces. */
async function mount(
  source: Observable<SettingsFormView>,
  wide = true,
  preview = vi.fn(),
  reminders: ReadonlyArray<{ id: string; sessionId: string; title: string; outcome: string }> = [],
) {
  const edit = vi.fn()
  const openSession = vi.fn()
  const dismiss = vi.fn()
  const acknowledge = vi.fn()
  const notifierState = new Observable({ reminders, audioUnlocked: true })
  const container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(createElement(SoundToggle, {
      form: { edit, resetField: vi.fn(), resetAll: vi.fn() },
      view: source,
      notifier: { preview, state: notifierState, dismiss, acknowledge, settingsSnapshot: source } as unknown as Notifier,
      openSession,
      wide,
      t,
    }))
  })
  const row = (): HTMLElement | null => container.querySelector('.yt-sound')
  const button = (): HTMLButtonElement | null => container.querySelector('button.yt-sound__trigger')
  const tooltip = (): HTMLElement | null => container.querySelector('.yt-sound__pending')
  return { container, row, button, tooltip, edit, preview, openSession, dismiss, acknowledge, notifierState }
}

/** Dispatch a bubbling pointer event the way the browser would. */
function pointer(target: Element, type: 'pointerover' | 'pointerout', relatedTarget: Element | null = null): void {
  target.dispatchEvent(new MouseEvent(type, { bubbles: true, relatedTarget }))
}

describe('sidebar-foot sound switch', () => {
  it('sits in the seat as "on" while the chime plays', async () => {
    const { row, button } = await mount(view('true'))
    expect(row()?.getAttribute('data-state')).toBe('on')
    expect(button()?.getAttribute('aria-pressed')).toBe('true')
    expect(button()?.getAttribute('aria-label')).toBe('sound.toggle.label')
    expect(button()?.getAttribute('title')).toBe('sound.toggle.mute')
    expect(button()?.disabled).toBe(false)
  })

  it('draws a monochrome glyph sized by the seat, with no literal color', async () => {
    const wide = await mount(view('true'), true)
    const wideGlyph = wide.button()!.querySelector('svg')!
    expect(wideGlyph.getAttribute('width')).toBe('16')
    expect(wideGlyph.getAttribute('height')).toBe('16')
    expect(wide.button()!.getAttribute('data-wide')).toBe('wide')
    expect(wide.row()!.getAttribute('data-rail')).toBeNull()

    const rail = await mount(view('true'), false)
    const railGlyph = rail.button()!.querySelector('svg')!
    expect(railGlyph.getAttribute('width')).toBe('18')
    expect(rail.button()!.getAttribute('data-wide')).toBe('rail')
    expect(rail.row()!.getAttribute('data-rail')).toBe('rail')

    // Stroke-only, `currentColor`, no fill and no hard-coded color anywhere:
    // this is what makes the icon inherit the theme instead of the emoji palette.
    for (const glyph of [wideGlyph, railGlyph]) {
      expect(glyph.getAttribute('stroke')).toBe('currentColor')
      expect(glyph.getAttribute('fill')).toBe('none')
      expect(glyph.getAttribute('aria-hidden')).toBe('true')
      const paths = [...glyph.querySelectorAll('path')]
      expect(paths.length).toBeGreaterThan(1)
      for (const path of paths) {
        expect(path.getAttribute('stroke')).toBeNull()
        expect(path.getAttribute('fill')).toBeNull()
        expect(path.getAttribute('d')).toBeTruthy()
      }
    }
  })

  it('swaps the waves for an X when muted', async () => {
    const on = await mount(view('true'))
    const muted = await mount(view('false'))
    const waves = [...on.button()!.querySelectorAll('path')].map((path) => path.getAttribute('d'))
    const slash = [...muted.button()!.querySelectorAll('path')].map((path) => path.getAttribute('d'))
    expect(slash[0]).toBe(waves[0])
    expect(slash.slice(1)).not.toEqual(waves.slice(1))
    expect(muted.row()!.getAttribute('data-state')).toBe('muted')
  })

  it('mutes through the settings queue and plays nothing while doing it', async () => {
    const source = view('true')
    const { button, edit, preview } = await mount(source)
    await act(async () => button()!.click())
    expect(edit).toHaveBeenCalledWith('soundEnabled', 'false')
    expect(preview).not.toHaveBeenCalled()
    // The projection the settings page would publish next: the switch follows it.
    await act(async () => source.set({ ...source.getSnapshot(), fields: { ...source.getSnapshot().fields, soundEnabled: { text: 'false', overridden: false, invalid: false } } }))
    expect(button()!.getAttribute('aria-pressed')).toBe('false')
    expect(button()!.getAttribute('title')).toBe('sound.toggle.unmute')
  })

  it('turns the chime back on and previews the configured voice', async () => {
    const { button, edit, preview } = await mount(view('false', { preset: 'ping' }))
    await act(async () => button()!.click())
    expect(edit).toHaveBeenCalledWith('soundEnabled', 'true')
    expect(preview).toHaveBeenCalledWith('ping')
  })

  it('falls back to a known voice when the configured preset is foreign', async () => {
    const { button, preview } = await mount(view('false', { preset: 'gong' }))
    await act(async () => button()!.click())
    expect(preview).toHaveBeenCalledWith('chime')
  })

  it('stays inert while the settings document refuses writes', async () => {
    const { button, edit } = await mount(view('true', { writable: false }))
    expect(button()?.disabled).toBe(true)
    await act(async () => button()!.click())
    expect(edit).not.toHaveBeenCalled()
  })

  it('renders nothing when the form exposes no sound field', async () => {
    const { container } = await mount(view('true', { fields: false }))
    expect(container.querySelector('button')).toBeNull()
  })

  it('shows a pending badge and a panel listing unread sessions', async () => {
    const reminders = [
      { id: 'a', sessionId: 'session-1', title: 'Refactor auth', outcome: 'completed' },
      { id: 'b', sessionId: 'session-2', title: 'Patch login', outcome: 'failed' },
    ]
    const { button, tooltip, row, openSession, acknowledge } = await mount(view('true'), true, vi.fn(), reminders)
    expect(row()?.getAttribute('data-pending')).toBe('true')
    expect(button()?.querySelector('.yt-sound__badge')?.textContent).toBe('2')
    // The panel holds buttons, so it is a popover dialog the trigger owns —
    // not a tooltip, which must not carry interactive content.
    expect(button()?.getAttribute('aria-haspopup')).toBe('dialog')
    expect(button()?.getAttribute('aria-controls')).toBe('yt-sound-pending')
    expect(tooltip()?.getAttribute('id')).toBe('yt-sound-pending')
    expect(tooltip()?.getAttribute('role')).toBe('dialog')
    expect(tooltip()?.getAttribute('aria-labelledby')).toBe('yt-sound-pending-title')
    const items = [...tooltip()!.querySelectorAll('.yt-sound__pendingItem')]
    expect(items.map(item => item.textContent)).toEqual([
      'Refactor auth',
      'Patch login',
    ])
    await act(async () => items[0]!.dispatchEvent(new Event('click', { bubbles: true })))
    expect(openSession).toHaveBeenCalledWith('session-1')
    expect(acknowledge).toHaveBeenCalledWith('a')
  })

  it('opens the panel when the pointer reaches the speaker', async () => {
    const { button, row } = await mount(view('true'), true, vi.fn(), [
      { id: 'a', sessionId: 'session-1', title: 'Refactor auth', outcome: 'completed' },
    ])
    expect(row()?.getAttribute('data-open')).toBeNull()
    expect(button()?.getAttribute('aria-expanded')).toBe('false')
    await act(async () => pointer(button()!, 'pointerover'))
    expect(row()?.getAttribute('data-open')).toBe('true')
    expect(button()?.getAttribute('aria-expanded')).toBe('true')
  })

  it('keeps the panel open while the pointer travels from the speaker into it', async () => {
    vi.useFakeTimers()
    try {
      const { button, row, tooltip } = await mount(view('true'), true, vi.fn(), [
        { id: 'a', sessionId: 'session-1', title: 'Refactor auth', outcome: 'completed' },
      ])
      await act(async () => pointer(button()!, 'pointerover'))
      expect(row()?.getAttribute('data-open')).toBe('true')
      // The pointer leaves the speaker for the panel: the departure is still
      // inside the switch, so the panel must not close on the way.
      await act(async () => pointer(button()!, 'pointerout', tooltip()!))
      await act(async () => { vi.advanceTimersByTime(1000) })
      expect(row()?.getAttribute('data-open')).toBe('true')
      // And once the pointer enters the panel it is open there too.
      await act(async () => pointer(tooltip()!, 'pointerover'))
      await act(async () => { vi.advanceTimersByTime(1000) })
      expect(row()?.getAttribute('data-open')).toBe('true')
    } finally {
      vi.useRealTimers()
    }
  })

  it('closes the panel once the pointer leaves the switch for good', async () => {
    vi.useFakeTimers()
    try {
      const { button, row, container } = await mount(view('true'), true, vi.fn(), [
        { id: 'a', sessionId: 'session-1', title: 'Refactor auth', outcome: 'completed' },
      ])
      await act(async () => pointer(button()!, 'pointerover'))
      expect(row()?.getAttribute('data-open')).toBe('true')
      await act(async () => pointer(button()!, 'pointerout', container.ownerDocument.body))
      await act(async () => { vi.advanceTimersByTime(1000) })
      expect(row()?.getAttribute('data-open')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('pins the panel without touching the mute switch', async () => {
    const { button, row, tooltip, edit } = await mount(view('true'), true, vi.fn(), [
      { id: 'a', sessionId: 'session-1', title: 'Refactor auth', outcome: 'completed' },
    ])
    const pin = tooltip()!.querySelector<HTMLButtonElement>('.yt-sound__pin')!
    expect(pin.getAttribute('aria-pressed')).toBe('false')
    await act(async () => pin.dispatchEvent(new Event('click', { bubbles: true })))
    expect(pin.getAttribute('aria-pressed')).toBe('true')
    expect(row()?.getAttribute('data-pinned')).toBe('true')
    expect(row()?.getAttribute('data-open')).toBe('true')
    // Reading the list must not cost a click on the speaker: the chime stays.
    expect(edit).not.toHaveBeenCalled()
    // Pinned means it survives the pointer leaving the switch.
    await act(async () => pointer(button()!, 'pointerout', document.body))
    expect(row()?.getAttribute('data-open')).toBe('true')
    await act(async () => pin.dispatchEvent(new Event('click', { bubbles: true })))
    expect(pin.getAttribute('aria-pressed')).toBe('false')
    expect(row()?.getAttribute('data-pinned')).toBeNull()
  })

  it('unpins on Escape and on a click outside the switch', async () => {
    const { row, tooltip } = await mount(view('true'), true, vi.fn(), [
      { id: 'a', sessionId: 'session-1', title: 'Refactor auth', outcome: 'completed' },
    ])
    const pin = tooltip()!.querySelector<HTMLButtonElement>('.yt-sound__pin')!
    await act(async () => pin.dispatchEvent(new Event('click', { bubbles: true })))
    expect(row()?.getAttribute('data-pinned')).toBe('true')
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(row()?.getAttribute('data-pinned')).toBeNull()

    await act(async () => pin.dispatchEvent(new Event('click', { bubbles: true })))
    expect(row()?.getAttribute('data-pinned')).toBe('true')
    await act(async () => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })))
    expect(row()?.getAttribute('data-pinned')).toBeNull()
  })

  it('keeps the panel open for the keyboard', async () => {
    const { button, row } = await mount(view('true'), true, vi.fn(), [
      { id: 'a', sessionId: 'session-1', title: 'Refactor auth', outcome: 'completed' },
    ])
    await act(async () => button()!.dispatchEvent(new FocusEvent('focusin', { bubbles: true })))
    expect(row()?.getAttribute('data-open')).toBe('true')
  })

  it('collapses the badge when every pending reminder has been read', async () => {
    const { button, tooltip, notifierState, row } = await mount(view('true'), true, vi.fn(), [
      { id: 'a', sessionId: 'session-1', title: 'Refactor auth', outcome: 'completed' },
    ])
    expect(row()?.getAttribute('data-pending')).toBe('true')
    expect(tooltip()).not.toBeNull()
    await act(async () => notifierState.set({ reminders: [], audioUnlocked: true }))
    expect(button()?.querySelector('.yt-sound__badge')).toBeNull()
    expect(tooltip()).toBeNull()
    expect(row()?.getAttribute('data-pending')).toBeNull()
  })
})
