# @wu5/dsh-your-turn

<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="@wu5/dsh-your-turn: a centred popup and a synthesized chime for every Agent handoff. Six voices generated in the browser, no audio files shipped.">
</p>

<p align="center">
  <strong>Turn-handoff reminder for DeepSeek Harness.</strong><br>
  A real popup you can act on, plus a chime the moment an Agent hands the turn back to you.
</p>

<p align="center">
  <a href="./README.zh.md">简体中文</a> · <a href="https://github.com/WenOwen/dsh-your-turn/issues">Report a bug</a> · <a href="https://github.com/WenOwen/dsh-your-turn">Source</a>
</p>

---

## What it does

A DeepSeek Harness session is rarely watched the whole time — the user is in another tab, in another app, or just thinking. The moment the Agent stops and hands the turn back, this plugin raises a focused reminder so the handoff is never silent:

- A **centred modal** with focus management, Escape, and a backdrop close. The turn's outcome, the session title, its directory, and the turn duration are all on one card. Three actions: **Open session**, **Snooze 5 min**, **Got it**.
- A **top banner** alternative for when a modal feels heavy.
- A **synthesized chime** — six voices, every one generated at runtime by the Web Audio API. No audio files are shipped, so the bundle stays small and the sound is yours to tune.
- A **speaker icon in the sidebar's foot** that mirrors the sound switch, with a small unread badge. Hover it to see every session still waiting on you; click one to jump to it.

## Why it's different

Most "reminder" plugins for AI agents either need a separate server, a Host-side patch with a poll loop, or a file watcher. `@wu5/dsh-your-turn` doesn't. The Web client already knows when every session's Agent stops — it has to, to render the running dot. This plugin reads that same state in-process:

- **Zero audio assets.** The plugin ships no `.mp3` or `.wav`. Every voice is `OscillatorNode + GainNode` with an exponential attack-and-decay envelope; a `DynamicsCompressor` at the end of the graph lets the master gain sit above full scale without clipping.
- **Zero Host Remote.** No API gateway contribution, no schema to declare, no extra surface. The browser side is a single Cordis plugin that registers a slot and a settings section.
- **No file watching.** No session log polling. The handoff is observed the moment the Host publishes it to the Web client.
- **Cross-tab aware.** Open three tabs on the same origin and only one reminder raises. Closing it in one closes it in all.

## How it works

<p align="center">
  <img src="./assets/readme/workflow.svg" width="100%" alt="End-to-end flow: Agent turn end → Web client turn watcher → Notifier queue → modal or banner + speaker badge.">
</p>

The plugin lives in two halves that share one Cordis context. The **Host half** declares a small settings schema (`surface`, `autoDismissSeconds`, `volume`, `soundEnabled`, `soundPreset`, `errorSoundPreset`) and tells the settings service not to auto-generate its own page. The **browser half** installs the stylesheet, registers the Slot contributions, watches the Session list the Web client already publishes, and on every turn end:

1. filters subagent sessions and recently-dismissed ones,
2. enqueues a `Reminder` carrying the session id, title, directory, and outcome,
3. plays the configured success or failure voice through the speaker graph,
4. renders the modal (or banner) according to `surface`,
5. keeps the entry in the queue after auto-dismiss so the speaker badge stays useful, and clears it the moment you click **Open session**, **Got it**, or any other session in the workspace.

## Install

```bash
# From GitHub
npx @deepseek-ai/dsh plugin --profile <your-profile> add github:WenOwen/dsh-your-turn

# From npm (after publish)
npx @deepseek-ai/dsh plugin --profile <your-profile> add @wu5/dsh-your-turn
```

The plugin comes with a `cordis.patch.yml` and a prebuilt `lib/`; no build step is required on the user's machine. Restart Harness, reload the browser, and the reminder section is live. The settings page lives under **Settings → Turn-handoff reminder**.

## Settings

| Display name | Field | Default | Meaning |
| --- | --- | --- | --- |
| Reminder surface | `surface` | `modal` | `modal` or top banner `toast`; a retired `both` resolves to `modal`. |
| Auto-dismiss | `autoDismissSeconds` | `5` | The reminder closes itself after this long; `0` keeps it until you close it. Choose Never / 5s / 10s / 30s / 1 min / 2 min / 5 min, or pick Custom… and enter any value 0–600. |
| Play a chime | `soundEnabled` | `true` | Play a chime at all; the sidebar-foot speaker icon toggles this same field. |
| Success response | `soundPreset` | `chime` | Voice for a clean handoff. |
| Error response | `errorSoundPreset` | `alert` | Voice for a failed, aborted, or truncated turn. |
| Volume | `volume` | `70` | 0–100, applied to a 1.5× master gain with a brick-wall limiter. |

Six voices: `chime` (two-partial bell), `ping` (short tap), `marimba` (wooden attack), `arcade` (rising steps), `drop` (falling tone), `alert` (tri-tone). Silence is the sound switch, not a seventh voice.

## Compatibility

- **DeepSeek Harness `0.2.0-rc.2` / commit `04f392c9`**, runtime `0.1.7-rc.2` for the Cordis and Client packages.
- A Web-enabled profile is required, such as `web` or the app's `desktop` profile.
- A browser with the Web Audio API (every browser shipped in the last decade).
- The Client must stay connected to the Host to observe turn ends; closing the page disables reminders.

## Acknowledgements

- The Web client provides everything this plugin reads. No Host API was extended, no DSH core was modified.
- The plugin design follows the [build-deepseek-harness-plugin](../.agents/skills/build-deepseek-harness-plugin/SKILL.md) convention: one Cordis Loader entry, one Client Slot contribution, one Settings section, theme tokens reused.

## License

MIT.
