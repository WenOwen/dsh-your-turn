# Popup verification — initial inspection

This is the pre-change inspection record. Subsequent implementation and validation are recorded in [the final change report](<D:/Project/Code/dsh-your-turn/audit/settings-revision-verification.md>). The smoke script now checks unavailable **Host-mode** settings separately from the new browser-local remote form.

## Evidence baseline

- Project commit: 89242d3151bb10e3208e08bca70f4dc5aa4cbb20.
- Plugin: dsh-your-turn 0.1.0; development dependencies target DSH 0.1.7-rc.2.
- Running process: DSH Desktop with profile C:/Users/Administrator/.dsh/profiles/desktop.
- Installed Desktop / ui-layout / desktop-host: 0.2.0-rc.2.
- Desktop build commit: 04f392c9ddd144fa426da2045178797da6db6c11.
- Desktop profile declares dsh-your-turn as a link to the current workspace, and includes it in the bundle list. This proves the configured package, not the page's current loaded revision.

## DOM smoke verification

Command: bundled Node runs `audit/verify-popup.cjs` after `audit/extract-runtime.cjs` runs under Electron's Node mode.

The test loads the existing plugin `lib/client.js`, invokes its real `apply`, watcher, notifier and reminder component, and executes the unchanged shipped 0.2.0-rc.2 Modal and its focus/layer helpers in jsdom. Slot registration, settings/session services and audio are test doubles. Button markup is simplified; CSS is represented by class tokens.

| Scenario | Reminder queue | Modal DOM | Audio scheduled |
| --- | --- | --- | --- |
| Foreground, onlyWhenUnfocused=true | 0 | No | No |
| Foreground, onlyWhenUnfocused=false | 1 | Yes | Yes |
| Background, onlyWhenUnfocused=true | 1 | Yes | Yes |
| Unavailable settings fallback, synchronous short turn | 0 | No | No |

Escape removes the modal and reminder in the two positive cases. Script exits 0.

## Confirmed findings

- The foreground filter rejects the entire reminder before audio is scheduled; it cannot by itself explain a sound from this plugin with no modal.
- Modal props and shell.overlay declaration remain compatible in the inspected 0.2.0-rc.2 artifacts. The isolated test does not reproduce a version-interface failure.
- Existing tests/client-wiring.test.ts substitutes Modal and Toast with functions returning null and does not mount the real overlay, so that suite does not prove popup visibility.
- Default bundle settings: onlyWhenUnfocused=true, surface=modal, autoDismissSeconds=45.

## Not verified

- Current live page boot manifest, settings state, overlay registration/assembly and errors.
- CSS paint, z-index against other active overlays, real browser focus, sound provenance and simultaneous-tab effects.
- HTTP GET to http://127.0.0.1:19387/ requires a DSH authenticated URL/login; no live authenticated page content was retrieved. No browser automation or session mutation was performed.

## Scope

No functional source, installed profile settings or running process was modified. Added audit scripts and generated runtime evidence only. The reported 'sound but no popup' has not been conclusively reproduced or diagnosed in the user's live page.
