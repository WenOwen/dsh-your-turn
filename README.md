# dsh-your-turn

**Turn-handoff reminder for DeepSeek Harness.** When a session's agent stops and
hands the turn back to you, this plugin raises a centred popup you can actually
act on, and plays a chime — every voice synthesized in the browser, so the plugin
ships no audio files at all.

中文文档：[README.zh.md](README.zh.md)

---

## What it does

- **Notices the handoff.** It watches the Agent running state the Web client
  already holds for every session, so it works for sessions you are not looking
  at, without a Host Remote, a poll, or a file watcher.
- **Raises a real popup.** A centred modal with focus management, Escape and
  backdrop close, the turn's outcome, the session title, its directory, the turn
  duration, and three buttons: **Open session**, **Remind me in 5 minutes**,
  **Got it**. A lightweight top banner is available instead of the popup.
- **Plays a chime.** Six voices — a two-partial bell, a short ping, a wooden
  marimba, a rising arcade arpeggio, a falling drop, and a tri-tone for
  failures — plus independent success and failure voices and a volume control.
  Silence is the sound switch, not a seventh voice.
- **Silences in one click.** A small speaker icon sits in the sidebar's foot,
  right beside the remote-web-ui phone: click it to mute (the glyph turns into a
  slashed speaker), click again to bring the chime back, which also previews the
  configured voice. It writes the very same `soundEnabled` field the settings
  page shows, so the two can never disagree; the reminder itself still appears
  while muted.
- **Reminds for every ending.** Completed, failed, aborted, limited, and unknown
  outcomes all qualify, regardless of turn length. The background-only option still
  controls when reminders appear; subagent sessions never raise reminders or question chimes.
- **Dismisses itself on a clock.** Popups and banners close five seconds after
  they appear, configurable per deployment (0 keeps them until you close them);
  snoozing starts a fresh clock on the re-raise.
- **Coordinates open windows.** Three tabs on the same origin raise one reminder,
  not three, and closing it in one closes it everywhere.
- **Remembers what matters.** Pushed-back reminders survive a reload; every policy
  setting lives in the deployment's settings document and
  reaches every browser pointed at it.

## What it does not do

- It does not notify for the `tui` or `headless` profiles: there is no browser to
  draw in. Only the `web` profile has a client half at all.
- It does not send notifications when no browser is connected.
- It does not read, modify, or depend on the conversation DOM, any Harness
  internal class name, or any private API.

## Requirements

- DeepSeek Harness **`0.1.7-rc.2`** (built and verified against that version; the
  client bundle requires only Web baseline modules — `react`,
  `react/jsx-runtime`, and `@deepseek-ai/dsh-client-ui-primitives` — so it shares
  the shell's React instance rather than carrying a second copy).
- A `web` profile.

## Install

```bash
npx @deepseek-ai/dsh plugin --profile web add github:<owner>/dsh-your-turn
```

Restart the Harness process, then refresh the browser page. The Host side needs
the restart; the client bundle additionally needs the page reload.

Published to npm (optional): `npx @deepseek-ai/dsh plugin --profile web add dsh-your-turn`.

From a local checkout, without publishing:

```bash
npx @deepseek-ai/dsh plugin --profile web add file:D:\path\to\dsh-your-turn
```

For a reproducible or high-security install, pin the commit — `pnpm` resolves the
Git ref into the profile lockfile, so an unpinned install is a moving target:

```bash
npx @deepseek-ai/dsh plugin --profile web add github:<owner>/dsh-your-turn#<sha>
```

`lib/` is committed, so a Git install runs no build step and needs no `allowBuilds`
authorisation in the profile's `pnpm-workspace.yaml`.

### Update

```bash
npx @deepseek-ai/dsh plugin --profile web remove dsh-your-turn
npx @deepseek-ai/dsh plugin --profile web add github:<owner>/dsh-your-turn#<new-sha>
```

A remove-then-add is the reliable refresh: a plain re-add can keep serving the
cached tarball. Restart the Harness afterwards either way.

### Remove

```bash
npx @deepseek-ai/dsh plugin --profile web remove dsh-your-turn
```

Disabling it in DSH's plugin manager is usually enough and needs no uninstall.
For a file-based profile, disable the Loader row:

```yaml
- id: your-turn
  disabled: true
```

## Where the data lives

| What | Where | Notes |
| --- | --- | --- |
| Local page settings | the active profile's Cordis patch, `~/.dsh/profiles/<name>/cordis.patch.yml`, under entry id `your-turn` | Written by the shipped settings service; the plugin declares the fields as `.volatile()` so they are editable from Settings → **Your turn**. |
| Remote page settings | browser `localStorage`, key `dsh-your-turn/settings/v1` | Per-browser and origin; does not write to the desktop deployment. |
| Pushed-back reminders | browser `localStorage`, key `dsh-your-turn/state/v1` | Inherently per-browser; validated on read and dropped when malformed. |

> **A profile patch row replaces the whole `config` block — it does not deep
> merge.** If you override one field by hand, restate all of them; the settings
> page does this correctly for you because it writes the complete resolved
> section.

No credentials, tokens, or network calls of any kind are involved.

## Settings

The settings page renders exactly these nine rows, in this order. The first five
carry no group heading; the last four sit under **Chime**.

| Settings page | Field | Default | Meaning |
| --- | --- | --- | --- |
| Reminder timing | `onlyWhenUnfocused` | `true` | Stay silent while the window is focused and the tab visible. |
| Reminder surface | `surface` | `modal` | `modal` or `toast`; a retired `both` resolves to `modal`. |
| Auto-dismiss (seconds) | `autoDismissSeconds` | `5` | The reminder closes itself after this long; `0` keeps it until you close it. |
| Flash the tab title | `flashTitle` | `false` | Alternate a marker in the tab title until the window regains focus. |
| Also send a system notification | `systemNotification` | `false` | Mirror into a system notification while the page is hidden. |
| Play a chime | `soundEnabled` | `true` | Play a chime at all; the sidebar-foot speaker icon toggles this same field. |
| Success response | `soundPreset` | `chime` | Voice for a clean handoff. |
| Failure response | `errorSoundPreset` | `alert` | Voice for a failed, aborted, or truncated turn. |
| Volume | `volume` | `70` | 0–100. |

## How a finished turn is detected

The Agent reports its running state to every connected browser — `dsh-agent-loop`
derives it from its phase being neither `idle` nor `maintenance`, and
`dsh-api-session-controller` mirrors each transition into the session list the Web
client already holds. A `true → false` edge on one session row is therefore the
handoff this plugin is about, and it needs nothing the client does not already
publish.

The edge says *that* the turn ended, not *how*. Where the browser also holds the
session's event window — its conversation is open in this page — the matching
`turn/end` record is read for the exact reason and turn number. Every other
session is treated as a clean handoff, which is what "the agent went idle" means.

## Question chimes

On the verified DSH `0.2.0-rc.2` runtime, the official `uiSession.sessionStatus`
pending-interaction source chimes once for a new question, even in the foreground
or while the agent is still running. It does not put another modal over the question.
It reuses the sound switch, the success preset, and the volume; the background-only
option does not apply, and a subagent's question stays silent.
Refreshing a question's status or hiding and reopening its card does not repeat the sound. Plan reviews, approvals,
and ordinary text questions do not trigger it. Older/reduced compositions without
this service keep turn-end reminders but have no question chime.

## Known limitations

1. **One reminder per idle period, not per turn.** Several turns queued
   back-to-back keep the Agent running, so you get one reminder at the end rather
   than one per turn. This is deliberate: it is the point at which the turn really
   is yours.
2. **Duration is a lower bound.** It is measured from the moment *this page*
   observed the session running. A page that loads mid-turn reports the part it
   saw.
3. **The exact reason needs the conversation open here.** A session you have never
   opened in this browser classifies as a clean handoff.
4. **Audio needs one gesture.** Browsers keep audio suspended until the page has
   been interacted with. The plugin resumes on the first pointer or key event;
   until then the popup still appears and stays silent. Clicking a sound preset in settings
   unlocks audio, previews that voice immediately, and saves the selection.
5. **Remote preferences belong to this browser.** The Host settings wire stays
   loopback-only. Explicit memory-mode remote pages save to browser `localStorage`
   (`dsh-your-turn/settings/v1`), not the desktop deployment. Options select immediately;
   options, switches and valid inputs apply automatically, with no Save button. Confirmed saves briefly fade in “Changes saved” in a reserved bottom status slot; failures show an error there and retain the input.
6. **Cross-window de-duplication is per origin.** Tabs and windows sharing an
   origin coordinate through `BroadcastChannel`. The same conversation open on a
   desktop browser and a phone is two origins, and both will remind — which is
   usually what you want, and is stated here so it is not a surprise.

## Development

```bash
pnpm install
pnpm typecheck     # tsc --noEmit
pnpm test          # config, watchers, notifier, settings interaction, storage, bundle smoke
pnpm build         # lib/index.js + lib/client.js
pnpm check         # the plugin structure/contract checker
```

`lib/` is generated but committed, so the repository installs and runs without a
build step. Rebuild and commit it whenever `src/` changes.

The bundle layout is deliberate: the ModuleLoader id is exactly the package name,
every `require(...)` is a Web baseline word (asserted by `tests/bundle.test.ts`),
and the whole factory body runs inside a `try` so a bundle that cannot resolve its
platform words degrades to an inert module with one console warning instead of
taking the page down with it.

## License

MIT.
