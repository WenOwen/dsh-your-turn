/**
 * The plugin's stylesheet, carried as a string.
 *
 * A Web client bundle is one CommonJS factory with no module table for assets
 * and no guarantee that a sibling `.css` file is reachable from the install
 * directory, so the sheet travels inside the bundle and is installed as a
 * single owned `<style data-plugin-css>` element. Installation is idempotent and
 * the disposer removes the element, so disabling the plugin leaves nothing
 * behind.
 *
 * Every rule is scoped under this plugin's root class or its `data-plugin`
 * attribute: an overlay entry, a settings section, and a settings row are three
 * independent DOM subtrees, and none of them may rely on another's ancestor.
 *
 * @module dsh-your-turn/client/styles
 */

/** Attribute marking the installed sheet; also the HMR de-duplication key. */
export const STYLE_ELEMENT_ID = 'dsh-your-turn'

/** Appearance shared by every surface this plugin mounts. */
export const CSS = `
[data-plugin="dsh-your-turn"] {
  --yt-gap: 12px;
  --yt-radius: var(--dsw-radius-md, 10px);
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family, inherit);
}

/* Persistent banner: the shipped Toast always expires, so it is not used here. */
[data-plugin="dsh-your-turn"].yt-banner {
  position: fixed;
  inset-block-start: 16px;
  inset-inline-start: 50%;
  transform: translateX(-50%);
  inline-size: min(520px, calc(100vw - 32px));
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--yt-radius);
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: var(--dsw-elevation-prominent);
  pointer-events: auto;
}
[data-plugin="dsh-your-turn"] .yt-banner__text {
  flex: 1;
  min-inline-size: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-wrap: anywhere;
  font-size: 0.875em;
}
[data-plugin="dsh-your-turn"] .yt-banner__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/*
 * The sound switch in the sidebar's foot seat (sidebar.footer.action, owned
 * by ui-sidebar, shared with the remote-web-ui phone trigger). The seat's owner
 * positions the row, so this only carries the family geometry the seat expects:
 * a 36px transparent circle in the rail, a growing full-row pill when the
 * column is wide, and the same hover/active/focus tokens the phone trigger
 * uses — no literal colors, so light and dark both come from the theme.
 */
[data-plugin="dsh-your-turn"].yt-sound {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

[data-plugin="dsh-your-turn"].yt-sound[data-rail='rail'] {
  flex-direction: column-reverse;
  gap: 4px;
}

[data-plugin="dsh-your-turn"] .yt-sound__trigger {
  position: relative;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 36px;
  block-size: 36px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
}

[data-plugin="dsh-your-turn"] .yt-sound__trigger[data-wide='wide'] {
  flex: 1 1 auto;
  justify-content: flex-start;
  inline-size: auto;
  min-inline-size: 0;
  border-radius: 999px;
  gap: 8px;
  padding: 0 10px;
}

[data-plugin="dsh-your-turn"] .yt-sound__trigger:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

[data-plugin="dsh-your-turn"] .yt-sound__trigger:active:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-active);
}

[data-plugin="dsh-your-turn"] .yt-sound__trigger:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--dsw-alias-bg-layer-2), 0 0 0 4px var(--dsw-alias-brand-primary);
}

/* Muted reads as "off" — the glyph changes and the color recedes with it. */
[data-plugin="dsh-your-turn"].yt-sound[data-state='muted'] .yt-sound__trigger:not(:hover) {
  color: var(--dsw-alias-label-tertiary);
}

[data-plugin="dsh-your-turn"] .yt-sound__trigger:disabled {
  opacity: 0.5;
  cursor: default;
}

[data-plugin="dsh-your-turn"] .yt-sound__glyph {
  flex: none;
  display: block;
}

/*
 * The unread badge: a small numeric chip parked on the top-right of the
 * speaker. Visible only while at least one reminder is still pending (raised
 * turn the user has not yet looked at). The hover tooltip is the next block
 * and is what actually lists the session titles.
 */
[data-plugin="dsh-your-turn"] .yt-sound__badge {
  position: absolute;
  inset-block-start: 2px;
  inset-inline-end: 2px;
  min-inline-size: 16px;
  block-size: 16px;
  padding: 0 4px;
  box-sizing: border-box;
  border-radius: 999px;
  background: var(--dsw-alias-state-error-primary, var(--dsw-alias-link));
  color: var(--dsw-alias-label-on-color, #fff);
  font-size: 10px;
  line-height: 14px;
  font-weight: 600;
  text-align: center;
  pointer-events: none;
  transform-origin: center;
  animation: yt-sound-badge-pulse 2.4s ease-in-out infinite;
}
@keyframes yt-sound-badge-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.18); }
}
@media (prefers-reduced-motion: reduce) {
  [data-plugin="dsh-your-turn"] .yt-sound__badge { animation: none; }
}

/*
 * The pending list that appears when the user hovers or focuses the speaker.
 * Anchored above the icon in the rail and wide enough to read a session title.
 * Pure CSS reveal (no JS event handlers), so it inherits the seat's own focus
 * behaviour and never steals pointer or keyboard focus from the toggle.
 */
[data-plugin="dsh-your-turn"] .yt-sound__pending {
  position: absolute;
  inset-block-end: calc(100% + 8px);
  inset-inline-start: 0;
  min-inline-size: 200px;
  max-inline-size: 280px;
  max-block-size: 240px;
  overflow-y: auto;
  padding: 8px;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--yt-radius);
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: var(--dsw-elevation-prominent);
  opacity: 0;
  transform: translateY(4px);
  pointer-events: none;
  transition: opacity 140ms ease, transform 140ms ease;
  z-index: 1;
}
[data-plugin="dsh-your-turn"].yt-sound[data-rail='rail'] .yt-sound__pending {
  inset-inline-start: 0;
  inset-inline-end: auto;
}
[data-plugin="dsh-your-turn"].yt-sound:hover .yt-sound__pending,
[data-plugin="dsh-your-turn"].yt-sound:focus-within .yt-sound__pending {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
@media (prefers-reduced-motion: reduce) {
  [data-plugin="dsh-your-turn"] .yt-sound__pending { transition: none; }
}

[data-plugin="dsh-your-turn"] .yt-sound__pendingTitle {
  margin: 0 0 6px;
  padding: 0 6px;
  font-size: 0.75em;
  line-height: 1.4;
  color: var(--dsw-alias-label-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

[data-plugin="dsh-your-turn"] .yt-sound__pendingList {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

[data-plugin="dsh-your-turn"] .yt-sound__pendingItem {
  display: flex;
  align-items: center;
  gap: 8px;
  inline-size: 100%;
  min-inline-size: 0;
  padding: 6px 8px;
  box-sizing: border-box;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 0.8125em;
  line-height: 1.4;
  text-align: start;
  cursor: pointer;
  transition: background-color 120ms ease;
}
[data-plugin="dsh-your-turn"] .yt-sound__pendingItem:hover,
[data-plugin="dsh-your-turn"] .yt-sound__pendingItem:focus-visible {
  background: var(--dsw-alias-interactive-bg-hover);
  outline: none;
}

[data-plugin="dsh-your-turn"] .yt-sound__pendingDot {
  flex: none;
  inline-size: 8px;
  block-size: 8px;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary);
}
[data-plugin="dsh-your-turn"] .yt-sound__pendingDot[data-outcome="completed"] { background: var(--dsw-alias-state-success-primary); }
[data-plugin="dsh-your-turn"] .yt-sound__pendingDot[data-outcome="failed"] { background: var(--dsw-alias-state-error-primary); }
[data-plugin="dsh-your-turn"] .yt-sound__pendingDot[data-outcome="aborted"] { background: var(--dsw-alias-state-warn-primary); }
[data-plugin="dsh-your-turn"] .yt-sound__pendingDot[data-outcome="limited"] { background: var(--dsw-alias-state-warn-primary); }

[data-plugin="dsh-your-turn"] .yt-sound__pendingName {
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── The reminder in the centred popup ─────────────────────────────────── */

[data-plugin="dsh-your-turn"].yt-reminder {
  display: flex;
  flex-direction: column;
  gap: var(--yt-gap);
  min-width: 0;
}

[data-plugin="dsh-your-turn"] .yt-reminder__status {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 0.875em;
  line-height: 1.5;
  color: var(--dsw-alias-label-secondary);
}

[data-plugin="dsh-your-turn"] .yt-reminder__dot {
  flex: none;
  inline-size: 8px;
  block-size: 8px;
  border-radius: 50%;
  background: var(--dsw-alias-state-idle-primary);
}

[data-plugin="dsh-your-turn"] .yt-reminder__dot[data-outcome="completed"] { background: var(--dsw-alias-state-success-primary); }
[data-plugin="dsh-your-turn"] .yt-reminder__dot[data-outcome="failed"] { background: var(--dsw-alias-state-error-primary); }
[data-plugin="dsh-your-turn"] .yt-reminder__dot[data-outcome="aborted"] { background: var(--dsw-alias-state-warn-primary); }
[data-plugin="dsh-your-turn"] .yt-reminder__dot[data-outcome="limited"] { background: var(--dsw-alias-state-warn-primary); }

[data-plugin="dsh-your-turn"] .yt-reminder__session {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--yt-radius);
  background: var(--dsw-alias-bg-layer-2);
}

[data-plugin="dsh-your-turn"] .yt-reminder__title {
  margin: 0;
  min-width: 0;
  font-size: 1em;
  line-height: 1.45;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
  overflow-wrap: anywhere;
}

[data-plugin="dsh-your-turn"] .yt-reminder__path {
  margin: 0;
  min-width: 0;
  font-family: var(--dsw-font-markdown-code-font-family, ui-monospace, monospace);
  font-size: 0.8125em;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
  overflow-wrap: anywhere;
}

[data-plugin="dsh-your-turn"] .yt-reminder__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.8125em;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}

[data-plugin="dsh-your-turn"] .yt-reminder__queued {
  margin: 0;
  font-size: 0.8125em;
  line-height: 1.5;
  color: var(--dsw-alias-label-secondary);
}

[data-plugin="dsh-your-turn"].yt-reminder__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

/* ── Settings page ─────────────────────────────────────────────────────── */

[data-plugin="dsh-your-turn"].yt-settings {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
  max-inline-size: 720px;
}

[data-plugin="dsh-your-turn"] .yt-settings__intro,
[data-plugin="dsh-your-turn"] .yt-settings__footer {
  margin: 0;
  font-size: 0.875em;
  line-height: 1.6;
  color: var(--dsw-alias-label-secondary);
}

[data-plugin="dsh-your-turn"] .yt-settings__footer {
  color: var(--dsw-alias-label-tertiary);
}

[data-plugin="dsh-your-turn"] .yt-settings__group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

[data-plugin="dsh-your-turn"] .yt-settings__groupTitle {
  margin: 0 0 4px;
  font-size: 0.8125em;
  line-height: 1.5;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-tertiary);
}

[data-plugin="dsh-your-turn"] .yt-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 8px 16px;
  min-width: 0;
  padding: 10px 0;
  border-top: 1px solid var(--dsw-alias-border-l1);
}

[data-plugin="dsh-your-turn"] .yt-settings__group .yt-row:first-of-type { border-top: 0; }

[data-plugin="dsh-your-turn"] .yt-row__label {
  min-width: 0;
  font-size: 0.875em;
  line-height: 1.5;
  color: var(--dsw-alias-label-primary);
}

[data-plugin="dsh-your-turn"] .yt-row__hint {
  margin: 2px 0 0;
  min-width: 0;
  font-size: 0.8125em;
  line-height: 1.55;
  color: var(--dsw-alias-label-tertiary);
  overflow-wrap: anywhere;
}

[data-plugin="dsh-your-turn"] .yt-row__hint[data-invalid="true"] { color: var(--dsw-alias-label-error); }

[data-plugin="dsh-your-turn"] .yt-row__control {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-inline-size: 320px;
}

[data-plugin="dsh-your-turn"] .yt-row__badges {
  display: flex;
  align-items: center;
  gap: 8px;
  grid-column: 1 / -1;
  min-width: 0;
}

/*
 * Chip rows keep every option on one line: the six-voice vocabularies are meant
 * to be read at a glance, so the control column drops its width cap and the
 * chips never wrap. A panel too narrow to hold them scrolls the row instead of
 * stacking it into a second line.
 */
[data-plugin="dsh-your-turn"] .yt-row[data-control="chips"] .yt-row__control {
  max-inline-size: none;
}

[data-plugin="dsh-your-turn"] .yt-row__chips {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-inline: contain;
  scrollbar-width: none;
}

[data-plugin="dsh-your-turn"] .yt-row__chips::-webkit-scrollbar { display: none; }

[data-plugin="dsh-your-turn"] .yt-row__chip {
  flex: none;
  padding-inline: 9px;
}

[data-plugin="dsh-your-turn"] .yt-row__chip[aria-pressed="true"] {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  box-shadow: inset 0 0 0 2px var(--dsw-alias-link);
}

[data-plugin="dsh-your-turn"] .yt-settings__feedback {
  position: relative;
  flex: none;
  block-size: 2.8em;
  font-size: 0.8125em;
  line-height: 1.4;
}
[data-plugin="dsh-your-turn"] .yt-settings__feedbackText {
  position: absolute;
  inset-inline: 0;
  inset-block-start: 0;
  max-block-size: 2.8em;
  overflow-y: auto;
  overflow-wrap: anywhere;
  opacity: 0;
  transition: opacity 220ms ease;
  color: var(--dsw-alias-state-success-primary);
}
[data-plugin="dsh-your-turn"] .yt-settings__feedbackText[data-visible="true"] { opacity: 1; }
[data-plugin="dsh-your-turn"] .yt-settings__feedbackText[data-error="true"] { color: var(--dsw-alias-state-error-primary); }
@media (prefers-reduced-motion: reduce) {
  [data-plugin="dsh-your-turn"] .yt-settings__feedbackText { transition: none; }
}

[data-plugin="dsh-your-turn"] .yt-row__slider {
  display: flex;
  align-items: center;
  gap: 10px;
  inline-size: clamp(150px, 22vw, 260px);
  max-inline-size: 100%;
}

[data-plugin="dsh-your-turn"] .yt-row__range {
  flex: 1;
  min-inline-size: 0;
  margin: 0;
  accent-color: var(--dsw-alias-link);
  cursor: pointer;
}

[data-plugin="dsh-your-turn"] .yt-row__range:disabled { cursor: default; }
[data-plugin="dsh-your-turn"] .yt-row__range:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color);
  outline-offset: 3px;
}

[data-plugin="dsh-your-turn"] .yt-row__rangeValue {
  min-inline-size: 4ch;
  text-align: end;
  font-size: 0.875em;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
}

[data-plugin="dsh-your-turn"] .yt-row__input {
  inline-size: 7em;
  text-align: end;
}

/*
 * The preset/auto-dismiss control: a dropdown next to an optional number
 * input. The two share a row that flexes; the number input is removed from
 * layout when the dropdown is on a preset.
 */
[data-plugin="dsh-your-turn"] .yt-row__select {
  display: flex;
  align-items: center;
  gap: 8px;
  min-inline-size: 0;
}
[data-plugin="dsh-your-turn"] .yt-row__selectInput {
  flex: 0 0 auto;
  inline-size: 9.5em;
  padding: 4px 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--dsw-radius-sm, 6px);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 0.875em;
  line-height: 1.5;
  cursor: pointer;
}
[data-plugin="dsh-your-turn"] .yt-row__selectInput:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color);
  outline-offset: 2px;
}
[data-plugin="dsh-your-turn"] .yt-row__selectInput:disabled {
  cursor: default;
  opacity: 0.6;
}

[data-plugin="dsh-your-turn"] .yt-row__text {
  inline-size: 6em;
  text-align: center;
}

[data-plugin="dsh-your-turn"] .yt-row__reset {
  border: 0;
  padding: 0;
  background: none;
  font: inherit;
  font-size: 0.8125em;
  line-height: 1.5;
  color: var(--dsw-alias-link);
  cursor: pointer;
}

[data-plugin="dsh-your-turn"] .yt-row__reset:hover { text-decoration: underline; }

[data-plugin="dsh-your-turn"] .yt-row__reset:focus-visible,
[data-plugin="dsh-your-turn"] .yt-row__chip:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color);
  outline-offset: 2px;
}

[data-plugin="dsh-your-turn"] .yt-row__note {
  margin: 0;
  font-size: 0.8125em;
  line-height: 1.5;
  color: var(--dsw-alias-state-warn-label);
}

[data-plugin="dsh-your-turn"] .yt-settings__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

/* The banner is the shipped Toast primitive; it is deliberately unstyled here. */

@media (prefers-reduced-motion: reduce) {
  [data-plugin="dsh-your-turn"] * {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
`

/**
 * Install the stylesheet once per document.
 *
 * Re-running with the same id updates the existing element instead of stacking a
 * second copy, so a hot reload cannot leave a stale sheet winning the cascade.
 *
 * @param doc - the document to install into; defaults to the current one.
 * @returns a disposer removing the element this call owns.
 */
export function installStyles(doc: Document | undefined = globalThis.document): () => void {
  if (doc === undefined) return () => undefined
  const selector = `style[data-plugin-css="${STYLE_ELEMENT_ID}"]`
  let element = doc.head.querySelector<HTMLStyleElement>(selector)
  if (element === null) {
    element = doc.createElement('style')
    element.dataset.pluginCss = STYLE_ELEMENT_ID
    doc.head.append(element)
  }
  if (element.textContent !== CSS) element.textContent = CSS
  return () => {
    element?.remove()
  }
}
