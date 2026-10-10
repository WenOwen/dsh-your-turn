const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const React = require('react');
const jsxRuntime = require('react/jsx-runtime');
const ReactDOM = require('react-dom');
const { createRoot } = require('react-dom/client');
const { act } = React;
const dom = new JSDOM('<!doctype html><html><body><main id="root"></main></body></html>', { url: 'http://localhost/' });
for (const key of ['window','document','HTMLElement','Event','KeyboardEvent','localStorage']) globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let focused = true;
Object.defineProperty(document, 'hasFocus', { value: () => focused, configurable: true });
Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
let plays = 0;
class AudioContext {
  state = 'running'; currentTime = 0; destination = {};
  createGain() { return { gain: { value: 0, setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){} }; }
  createOscillator() { return { frequency: { setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){}, start(){ plays++; }, stop(){} }; }
  async resume(){} async close(){}
}
globalThis.AudioContext = AudioContext;
// Execute the actual shipped Modal and all its focus/layer dependencies unchanged.
// CSS is represented by class-name tokens; this is DOM verification, not visual verification.
const shipped = fs.readFileSync(__dirname + '/runtime/primitives.js', 'utf8');
const layersCode = shipped.slice(shipped.indexOf('function observeComposition(document)'), shipped.indexOf('//#region lib/types/ShortcutKeys.js'));
const modalCode = shipped.slice(shipped.indexOf('function Modal({'), shipped.indexOf('//#region lib/types/RiskConfirmation.js'));
const ctx = vm.createContext({
  ...React, ...jsxRuntime, createPortal: ReactDOM.createPortal, HTMLElement: globalThis.HTMLElement,
  clsx: (...args) => args.filter(Boolean).join(' '), css$18: new Proxy({}, { get: (_, key) => 'modal-' + key }),
  IconCloseOutlineRegular: () => null, console, document,
});
vm.runInContext(layersCode + '\n' + modalCode + '\nglobalThis.ActualModal = Modal;', ctx);
class SettingsFormModel {
  constructor(){} dispose(){} shell(){ return {}; } field(){ return {}; }
  bind(){ return { getSnapshot: () => ({}), subscribe: () => () => {} }; } actions(){ return {}; }
}
const primitives = {
  Modal: ctx.ActualModal, SettingsFormModel,
  Button: ({ children, onClick }) => React.createElement('button', { onClick }, children),
};
let plugin;
globalThis.window.__ModuleLoader__ = { load(def) { plugin = def.factory((name) => {
  if (name === '@deepseek-ai/dsh-client-ui-primitives') return primitives;
  if (name === 'react') return React;
  if (name === 'react/jsx-runtime') return jsxRuntime;
  throw new Error('Unexpected request: ' + name);
}); } };
vm.runInThisContext(fs.readFileSync(__dirname + '/../lib/client.js', 'utf8'));
async function scenario(label, { attended, available = true }, expected) {
  focused = attended; plays = 0;
  const subscriptions = new Set(), registrations = [], disposers = [];
  let rows = { test: { running: false, displayTitle: 'Popup proof' } };
  const formValue = available ? { surface: 'modal' } : undefined;
  const host = {
    locale: { register: () => () => {}, bind: () => (key) => key },
    configForms: { get: () => ({ getSnapshot: () => ({ value: formValue, status: available ? 'ready' : 'unavailable', writable: available, mode: 'host' }), subscribe: () => () => {} }) },
    sessions: { list: { getSnapshot: () => ({ ids: ['test'], byId: rows }), subscribe: (fn) => { subscriptions.add(fn); return () => subscriptions.delete(fn); } }, binding: () => undefined },
    get: () => undefined,
    inject: () => () => undefined,
    slots: { inject: (_, fn) => fn(), register: (opts, component) => { registrations.push({ opts, component }); return () => {}; } },
    effect: (fn) => { const cleanup = fn(); if (typeof cleanup === 'function') disposers.push(cleanup); return cleanup; },
  };
  plugin.apply(host);
  const registration = registrations.find(({ opts }) => opts.name === 'shell.overlay');
  const injected = registration.opts.inject();
  const root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(registration.component, { ...injected, t: (key) => key })); });
  await act(async () => {
    rows = { test: { running: true, displayTitle: 'Popup proof' } }; for (const fn of subscriptions) fn();
    rows = { test: { running: false, displayTitle: 'Popup proof' } }; for (const fn of subscriptions) fn();
  });
  const result = { modal: !!document.querySelector('[role="dialog"]'), sound: plays > 0, queued: injected.notifier.state.getSnapshot().reminders.length };
  assert.equal(result.modal, expected);
  assert.equal(result.sound, expected);
  if (expected) {
    assert.match(document.querySelector('[role="dialog"]').textContent, /Popup proof/);
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(document.querySelector('[role="dialog"]'), null);
  }
  await act(async () => root.unmount());
  for (const fn of disposers.reverse()) fn();
  console.log(JSON.stringify({ label, ...result }));
}
(async () => {
  // Reminders now fire for every handoff regardless of focus: foreground, background, and
  // unavailable Host settings all reach the same expected result.
  await scenario('foreground, Host settings present', { attended: true, available: true }, true);
  await scenario('background, Host settings present', { attended: false, available: true }, true);
  await scenario('unavailable Host settings, short turn', { attended: false, available: false }, true);
  dom.window.close();
  console.log('PASS: built plugin queue -> actual 0.2.0-rc.2 Modal DOM + Escape close; no visual or live-browser assertion.');
})().catch(error => { console.error(error); dom.window.close(); process.exitCode = 1; });
