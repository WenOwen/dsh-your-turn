# Your turn 🔊

[简体中文（默认）](./README.md)

<p align="center">
  <img src="./assets/readme/hero.svg" width="100%" alt="Your turn: a DeepSeek Harness reminder with a speaker icon. Popups and chimes at turn handoff.">
</p>

`@wu5/dsh-your-turn` reminds you when an Agent hands the turn back in DeepSeek Harness. The repository homepage and visual labels use Chinese by default; the plugin UI supports Chinese and English.

## Features

- A centred popup or top banner for completed, failed, interrupted or limited turns, with session details and duration.
- Open the session, dismiss the reminder, or snooze it for five minutes.
- A chime when a new question needs your answer, without an extra popup covering the question.
- A sidebar speaker toggle and unread reminder list. Auto-dismissed popups remain in the list.
- Six voices synthesized by Web Audio, with separate success and failure choices and no shipped audio files.
- Coordination of turn-handoff reminders across tabs on the same origin.

## Install

Replace `web` with your Web-enabled profile name, such as `desktop`:

```bash
npx @deepseek-ai/dsh plugin --profile web add github:WenOwen/dsh-your-turn
```

The repository includes a Cordis patch and prebuilt `lib/`. Restart Harness, reload the browser, and open **Settings → Your turn**. Click **Preview** to unlock audio playback, then run an Agent turn to try the reminder.

## Settings

| Setting | Default | Details |
| --- | --- | --- |
| Surface | `modal` | Centred popup, or `toast` for a top banner. |
| Auto-dismiss | 5 seconds | Presets or a custom value from 0–600; 0 keeps it open. |
| Sound enabled | `true` | Controls both handoff and question chimes; shared with the sidebar speaker. |
| Success voice | `chime` | Voice for a normal handoff. |
| Failure voice | `alert` | Voice for failed, interrupted or limited turns. |
| Volume | 70 | Range: 0–100. |

Voices: `chime`, `ping`, `marimba`, `arcade`, `drop`, `alert`.

Options apply automatically and valid input saves automatically. Local pages save to the DSH deployment; remote pages save only in the current browser. Read-only or unavailable settings may prevent editing.

## Mechanism and compatibility

The plugin observes existing Web client session state, filters subagents, and queues handoff reminders. Pending questions trigger a separate chime. No extra background service, log polling, or DSH core changes are needed.

The project targets DeepSeek Harness `0.2.0-rc.2` (commit `04f392c9`) and Cordis / Client packages `0.1.7-rc.2`. Use a Web-enabled profile and a Web Audio-capable browser. Keep the page open and connected to the Host. Reminders render inside the DSH page; audio depends on browser permission and system volume.

## License

[MIT](./LICENSE).
