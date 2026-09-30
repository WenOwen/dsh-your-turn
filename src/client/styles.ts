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

[data-plugin="dsh-your-turn"] .yt-row__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

[data-plugin="dsh-your-turn"] .yt-row__input {
  inline-size: 7em;
  text-align: end;
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
