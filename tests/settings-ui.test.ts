/** @vitest-environment jsdom */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement, act } from 'react'
// The project ships React DOM without its optional type package; only this test uses createRoot.
const { createRoot } = createRequire(import.meta.url)('react-dom/client') as {
  createRoot(container: Element): { render(node: ReturnType<typeof createElement>): void; unmount(): void }
}
type Root = ReturnType<typeof createRoot>

// Exercise the actual shipped staging model and Pill, not the old null-component mocks.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
  const React = await import('react')
  const { jsx } = await import('react/jsx-runtime')
  // The host supplies this store engine in-browser; its npm entry has optional runtime peers.
  // Use the same getSnapshot/subscribe/set contract while keeping the staging model unchanged.
  const { Observable } = await import('../src/client/observable.ts')
  const createSnapshotStore = (value: unknown) => new Observable(value)
  const require = createRequire(import.meta.url)
  const code = readFileSync(process.env.DSH_PRIMITIVES_PATH ?? require.resolve('@deepseek-ai/dsh-client-ui-primitives'), 'utf8')
  const model = code.slice(code.indexOf('var SettingsFormModel = class'), code.indexOf('//#region lib/types/markdown/highlight.js'))
  const pill = code.slice(code.indexOf('function Pill({'), code.indexOf('//#region lib/types/SegmentedTabs.js'))
  const actual = new Function('createSnapshotStore', 'jsx', 'clsx', 'css$4', model + '\n' + pill + '\nreturn { SettingsFormModel, Pill };')(createSnapshotStore, jsx, (...items: unknown[]) => items.filter(Boolean).join(' '), { pill: 'pill', active: 'active', interactive: 'interactive' })
  return {
    ...actual,
    SettingsForm: ({ children, onSave }: { children: unknown; onSave: () => void }) => React.createElement('div', {}, children as never, React.createElement('button', { onClick: onSave }, 'Save')),
    Button: ({ children, variant: _, size: __, ...props }: any) => React.createElement('button', props, children),
    Tag: ({ children }: any) => React.createElement('span', {}, children),
    Modal: ({ children, footer }: any) => React.createElement('section', { 'data-modal': true }, children, footer),
    Input: (props: any) => React.createElement('input', props),
    Switch: ({ checked, onChange, label, ...props }: any) => React.createElement('button', { ...props, 'aria-pressed': checked, onClick: () => onChange(!checked) }, label),
  }
})

import { ImmediateSettings } from '../src/client/immediateSettings.ts'
import { BrowserSettings } from '../src/client/browserSettings.ts'
import { FIELD_SPECS } from '../src/client/formSpecs.ts'
import { SettingsPage } from '../src/client/SettingsPage.tsx'
import { ReminderSurface } from '../src/client/PopupOverlay.tsx'
import { Observable } from '../src/client/observable.ts'
import { normalizeConfig } from '../src/shared/settings.ts'
import { SettingsController } from '../src/client/settings.ts'
import type { Context } from '@deepseek-ai/cordis'
import type { Notifier } from '../src/client/notifier.ts'

let root: Root | undefined
let dispose: (() => void) | undefined
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
afterEach(async () => { await act(async () => root?.unmount()); dispose?.(); root = undefined; dispose = undefined; document.body.replaceChildren(); localStorage.clear(); vi.useRealTimers() })

describe('settings option interaction', () => {
  it('applies surface/sound/attention selections automatically, with no Save button', async () => {
    const scope = new BrowserSettings()
    const model = new ImmediateSettings(scope, FIELD_SPECS)
    dispose = () => model.dispose()
    const view = model.view
    const notifier = { state: new Observable({ reminders: [], audioUnlocked: true }), settingsSnapshot: new Observable({ config: normalizeConfig(undefined), status: 'ready', writable: true, storage: 'browser' }), preview: vi.fn() } as unknown as Notifier
    const container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    await act(async () => root!.render(createElement(SettingsPage, { form: model.actions, view, notifier, t: ((key: string) => key) as any })))
    const option = (name: string): HTMLButtonElement => [...container.querySelectorAll('button')].find((button) => button.textContent === name)!
    expect(option('option.surface.modal').getAttribute('aria-pressed')).toBe('true')
    await act(async () => option('option.surface.toast').click())
    expect(option('option.surface.toast').getAttribute('aria-pressed')).toBe('true')
    expect(option('option.surface.modal').getAttribute('aria-pressed')).toBe('false')
    expect(scope.getSnapshot().value?.surface).toBe('toast')
    expect([...container.querySelectorAll('button')].some(button => button.textContent === 'Save' || button.textContent === 'settings.save')).toBe(false)
    await act(async () => option('option.attention.always').click())
    expect(option('option.attention.always').getAttribute('aria-pressed')).toBe('true')
    expect(notifier.preview).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain('settings.preview')
    // There are two sound rows; selecting either previews exactly the chosen voice.
    await act(async () => option('option.sound.ping').click())
    expect(option('option.sound.ping').getAttribute('aria-pressed')).toBe('true')
    expect(notifier.preview).toHaveBeenLastCalledWith('ping')
    await act(async () => option('option.sound.ping').click())
    expect(notifier.preview).toHaveBeenCalledTimes(2)
    const errorRow = container.querySelector('#yt-field-errorSoundPreset')!
    const errorVoice = (name: string) => [...errorRow.querySelectorAll('button')].find(button => button.textContent === name)!
    await act(async () => errorVoice('option.sound.arcade').click())
    expect(notifier.preview).toHaveBeenLastCalledWith('arcade')
    expect(scope.getSnapshot().value?.errorSoundPreset).toBe('arcade')
    await act(async () => errorVoice('option.sound.drop').click())
    expect(notifier.preview).toHaveBeenLastCalledWith('drop')
    expect(scope.getSnapshot().value?.errorSoundPreset).toBe('drop')
    expect(scope.getSnapshot().value).toMatchObject({ surface: 'toast', soundPreset: 'ping', onlyWhenUnfocused: false })
    expect(new BrowserSettings().getSnapshot().value).toMatchObject({ surface: 'toast', soundPreset: 'ping', onlyWhenUnfocused: false })
    for (const key of [
      'settings.intro', 'settings.selectionHint', 'settings.hostStorage', 'settings.browserStorage',
      'settings.footer', 'settings.reset', 'settings.resetAll', 'settings.resetAllHint', 'settings.overridden',
      'settings.section.scope', 'settings.section.surface', 'settings.section.behaviour', 'settings.saving',
      ...['enabled', 'includeSubagents', 'muteAll', 'notifyOn', 'quietHoursEnabled', 'quietHoursStart', 'quietHoursEnd', 'minTurnSeconds'].map(field => `field.${field}.label`),
    ]) {
      expect(container.textContent).not.toContain(key)
    }
    expect(container.querySelector('.yt-row__hint')).toBeNull()
    expect(container.textContent).toContain('field.surface.label')
    for (const field of ['systemNotification', 'flashTitle', 'soundPreset', 'errorSoundPreset']) {
      expect(container.textContent).toContain(`field.${field}.label`)
    }
    // The surface vocabulary is one-of: the retired "both" option is gone, and
    // each tone row carries its own six audible voices, directly after the label.
    expect(option('option.surface.both')).toBeUndefined()
    expect(container.textContent).not.toContain('option.surface.both')
    expect(container.textContent).not.toContain('option.sound.none')
    const soundRow = container.querySelector('#yt-field-soundPreset')!
    expect(soundRow.querySelectorAll('button')).toHaveLength(6)
    expect([...soundRow.querySelectorAll('button')].map(button => button.textContent)).toEqual([
      'option.sound.chime', 'option.sound.ping', 'option.sound.marimba',
      'option.sound.arcade', 'option.sound.drop', 'option.sound.alert',
    ])
    expect([...soundRow.querySelectorAll('button')].find(button => button.getAttribute('aria-pressed') === 'true')?.textContent).toBe('option.sound.ping')
    // The tone rows must not stack into two lines: the chips never wrap.
    expect(container.querySelector('.yt-row[data-control="chips"]')).not.toBeNull()
    for (const field of ['enabled', 'includeSubagents', 'muteAll', 'notifyOn', 'quietHoursEnabled', 'quietHoursStart', 'quietHoursEnd', 'minTurnSeconds']) {
      expect(container.querySelector(`label[for="yt-field-${field}"]`)).toBeNull()
    }
    // The auto-dismiss delay is a live field again: a numeric row that applies
    // in-range values immediately and refuses out-of-range drafts.
    const delay = container.querySelector<HTMLInputElement>('#yt-field-autoDismissSeconds')!
    const setInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    expect(delay.placeholder).toBe('5')
    expect(delay.value).toBe('5')
    await act(async () => {
      setInput.call(delay, '30')
      delay.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(scope.getSnapshot().value?.autoDismissSeconds).toBe(30)
    await act(async () => {
      setInput.call(delay, '700')
      delay.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.textContent).toContain('settings.invalid')
    expect(scope.getSnapshot().value?.autoDismissSeconds).toBe(30)
    expect(model.view.getSnapshot().fields.surface?.overridden).toBe(true)
    expect(container.querySelector('.yt-row__reset, .yt-row__badges, .yt-settings__actions')).toBeNull()
    expect([...container.querySelectorAll('h3')].map(heading => heading.textContent)).toEqual([
      'settings.section.sound',
    ])
    const slider = container.querySelector<HTMLInputElement>('#yt-field-volume')!
    expect(slider.type).toBe('range')
    expect(slider.min).toBe('0')
    expect(slider.max).toBe('100')
    expect(slider.step).toBe('1')
    expect(slider.value).toBe('70')
    expect(container.querySelector('output[for="yt-field-volume"]')?.textContent).toBe('70%')
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
    for (const value of ['36', '0', '100']) {
      await act(async () => {
        setValue.call(slider, value)
        slider.dispatchEvent(new Event('input', { bubbles: true }))
      })
      expect(scope.getSnapshot().value?.volume).toBe(Number(value))
      expect(new BrowserSettings().getSnapshot().value?.volume).toBe(Number(value))
      expect(container.querySelector('output[for="yt-field-volume"]')?.textContent).toBe(`${value}%`)
    }
    await act(async () => model.actions.edit('volume', 'bad volume'))
    expect(container.textContent).toContain('settings.invalid')
  })
})

describe('reminder surfaces', () => {
  // The component owns no clock: it renders the queue the notifier publishes,
  // and the notifier's auto-dismiss timer is what removes entries over time.
  // This test drives the queue by hand and checks the actions reach the queue.
  it.each(['modal', 'toast'] as const)('renders the %s queue head and routes its actions', async (surface) => {
    vi.useFakeTimers()
    const first = { id: 'first', sessionId: 'session-a', title: 'First session', cwd: undefined, outcome: 'completed' as const, turn: undefined, durationMs: 1, raisedAt: 0, snoozed: false }
    const second = { ...first, id: 'second', sessionId: 'session-b', title: 'Second session' }
    const state = new Observable({ reminders: [first, second], audioUnlocked: true })
    const dismiss = vi.fn((id: string) => state.set({ ...state.getSnapshot(), reminders: state.getSnapshot().reminders.filter(reminder => reminder.id !== id) }))
    const notifier = { state, dismiss, settingsSnapshot: new Observable({ config: normalizeConfig({ surface }), status: 'ready', writable: true }) } as unknown as Notifier
    const openSession = vi.fn()
    const container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    await act(async () => root!.render(createElement(ReminderSurface, { notifier, openSession, t: ((key: string) => key) as any })))
    const visible = (): Element | null => container.querySelector(surface === 'modal' ? '[data-modal]' : '.yt-banner')
    expect(visible()?.textContent).toContain('First session')
    expect(dismiss).not.toHaveBeenCalled()
    const jumpKey = surface === 'modal' ? 'action.jump' : 'toast.jump'
    const jump = [...visible()!.querySelectorAll('button')].find(button => button.textContent === jumpKey)!
    await act(async () => jump.click())
    expect(openSession).toHaveBeenCalledWith('session-a')
    expect(dismiss).toHaveBeenCalledWith('first')
    expect(visible()?.textContent).toContain('Second session')
    const ignore = [...visible()!.querySelectorAll('button')].find(button => button.textContent === 'action.dismiss')!
    await act(async () => ignore.click())
    expect(visible()).toBeNull()
    expect(state.getSnapshot().reminders).toEqual([])
  })
})

describe('bottom save feedback', () => {
  it('reserves its slot, waits for accepted writes, fades out and never reports a failed write as saved', async () => {
    vi.useFakeTimers()
    const scope = new BrowserSettings()
    const realMutate = scope.mutate.bind(scope)
    let finish!: (accepted: boolean) => void
    const calls = vi.spyOn(scope, 'mutate').mockImplementationOnce((ops, revision) => new Promise(resolve => {
      finish = accepted => { if (accepted) void realMutate(ops, revision).then(resolve); else resolve(false) }
    }))
    const model = automatic(scope)
    const notifier = { preview: vi.fn() } as unknown as Notifier
    const container = document.createElement('div'); document.body.append(container); root = createRoot(container)
    await act(async () => root!.render(createElement(SettingsPage, { form: model.actions, view: model.view, notifier, t: ((key: string) => key === 'settings.saved' ? '已保存更改' : key) as any })))
    const feedback = container.querySelector('.yt-settings__feedback')!
    const message = (): HTMLElement => feedback.querySelector('.yt-settings__feedbackText')!
    expect(container.querySelector('.yt-settings')!.lastElementChild).toBe(feedback)
    expect(message().dataset.visible).toBe('false')
    expect(message().textContent).toBe('')
    await act(async () => model.actions.edit('surface', 'toast'))
    expect(model.view.getSnapshot().savedVersion).toBe(0)
    expect(message().dataset.visible).toBe('false')
    expect(container.querySelector('.yt-settings__notice')).toBeNull()
    expect(container.textContent).not.toContain('settings.saving')
    await act(async () => { finish(false); await settle() })
    expect(model.view.getSnapshot().savedVersion).toBe(0)
    expect(message().dataset.visible).toBe('true')
    expect(message().dataset.error).toBe('true')
    expect(message().textContent).toBe('settings.saveFailed')
    await act(async () => { model.actions.edit('surface', 'toast'); await settle() })
    expect(model.view.getSnapshot().savedVersion).toBe(1)
    expect(message().textContent).toBe('已保存更改')
    expect(message().dataset.visible).toBe('true')
    expect(message().dataset.error).toBe('false')
    await act(async () => vi.advanceTimersByTime(2500))
    expect(message().dataset.visible).toBe('false')
    expect(message().getAttribute('aria-hidden')).toBe('true')
    await act(async () => { model.actions.edit('volume', '25'); await settle() })
    await act(async () => vi.advanceTimersByTime(1000))
    await act(async () => { model.actions.edit('volume', '35'); await settle() })
    await act(async () => vi.advanceTimersByTime(2000))
    expect(message().dataset.visible).toBe('true')
    await act(async () => vi.advanceTimersByTime(500))
    expect(message().dataset.visible).toBe('false')
    expect(container.querySelector('.yt-settings')!.lastElementChild).toBe(feedback)
    calls.mockRestore()
  })
})

async function settle(): Promise<void> { for (let i = 0; i < 12; i++) await Promise.resolve() }
function automatic(scope = new BrowserSettings()): ImmediateSettings {
  const model = new ImmediateSettings(scope, FIELD_SPECS)
  dispose = () => model.dispose()
  return model
}
describe('automatic write queue', () => {
  it('updates the same resolved configuration that the reminder path reads', async () => {
    const raw = new BrowserSettings()
    const settings = new SettingsController({ configForms: { get: () => raw } } as unknown as Context)
    const model = new ImmediateSettings(settings.form!, FIELD_SPECS)
    dispose = () => { model.dispose(); settings.dispose() }
    model.actions.edit('surface', 'toast')
    model.actions.edit('onlyWhenUnfocused', 'false')
    await settle()
    expect(settings.config).toMatchObject({ surface: 'toast', onlyWhenUnfocused: false })
    expect(new BrowserSettings().getSnapshot().value).toMatchObject({ surface: 'toast', onlyWhenUnfocused: false })
  })
  it('does not lose fast same-field or different-field edits during an in-flight write', async () => {
    const scope = new BrowserSettings()
    const mutate = scope.mutate.bind(scope)
    const releases: (() => void)[] = []
    const calls = vi.spyOn(scope, 'mutate').mockImplementation((ops, revision) => new Promise(resolve => {
      releases.push(() => { void mutate(ops, revision).then(resolve) })
    }))
    const model = automatic(scope)
    model.actions.edit('volume', '20')
    model.actions.edit('volume', '30')
    model.actions.edit('volume', '80')
    model.actions.edit('surface', 'toast')
    expect(model.view.getSnapshot().fields.volume?.text).toBe('80')
    expect(calls).toHaveBeenCalledTimes(1)
    releases.shift()!(); await settle()
    expect(model.view.getSnapshot().fields.volume?.text).toBe('80')
    releases.shift()!(); await settle()
    releases.shift()!(); await settle()
    expect(calls).toHaveBeenCalledTimes(3)
    expect(scope.getSnapshot().value).toMatchObject({ volume: 80, surface: 'toast' })
    expect(model.view.getSnapshot().shell).toMatchObject({ saving: false, failed: false, dirty: false })
    calls.mockRestore()
  })
  it('keeps invalid input local without blocking a different switch', async () => {
    const scope = new BrowserSettings()
    const model = automatic(scope)
    model.actions.edit('volume', 'bad volume')
    model.actions.edit('soundEnabled', 'false')
    await settle()
    expect(scope.getSnapshot().value?.soundEnabled).toBe(false)
    expect(scope.getSnapshot().value?.volume).toBe(70)
    expect(model.view.getSnapshot().fields.volume).toMatchObject({ text: 'bad volume', invalid: true })
    model.actions.edit('volume', '35'); await settle()
    expect(scope.getSnapshot().value?.volume).toBe(35)
  })
  it('reports refusal, preserves the displayed choice and retries when selected again', async () => {
    const scope = new BrowserSettings()
    const calls = vi.spyOn(scope, 'mutate').mockResolvedValueOnce(false)
    const model = automatic(scope)
    model.actions.edit('surface', 'toast'); await settle()
    expect(model.view.getSnapshot().shell.failed).toBe(true)
    expect(model.view.getSnapshot().fields.surface?.text).toBe('toast')
    expect(scope.getSnapshot().value?.surface).toBe('modal')
    model.actions.edit('surface', 'toast'); await settle()
    expect(scope.getSnapshot().value?.surface).toBe('toast')
    expect(model.view.getSnapshot().shell.failed).toBe(false)
    calls.mockRestore()
  })
  it('resets all fields in one immediate atomic mutation', async () => {
    const scope = new BrowserSettings()
    await scope.set('surface', 'toast'); await scope.set('volume', 5)
    const calls = vi.spyOn(scope, 'mutate')
    const model = automatic(scope)
    model.actions.resetAll(); await settle()
    expect(calls).toHaveBeenCalledOnce()
    expect(calls.mock.calls[0]?.[0]).toHaveLength(FIELD_SPECS.length)
    expect(scope.getSnapshot().value).toMatchObject({ surface: 'modal', volume: 70 })
    expect(new BrowserSettings().getSnapshot().value).toMatchObject({ surface: 'modal', volume: 70 })
    calls.mockRestore()
  })
  it('drops queued writes when the plugin is disposed', async () => {
    const scope = new BrowserSettings()
    let release!: (accepted: boolean) => void
    const calls = vi.spyOn(scope, 'mutate').mockImplementation(() => new Promise(resolve => { release = resolve }))
    const model = automatic(scope)
    model.actions.edit('surface', 'toast'); model.actions.edit('volume', '20')
    model.dispose(); release(true); await settle()
    expect(calls).toHaveBeenCalledOnce()
    calls.mockRestore()
  })
})
