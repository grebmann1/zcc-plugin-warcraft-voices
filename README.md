# Warcraft Voices

An independent Zana Command Center plugin. Orc Peon, Human Peasant, Orc Grunt and Murloc voice lines for agents that need input or become idle. The shared sound-plugin APIs and authoring documentation were merged in [Zana PR #685](https://github.com/salesforce/zana/pull/685); this plugin uses only the public SDK.

## Use

```sh
zcc plugin install /path/to/warcraft-voices
```

Open **Plugins → Warcraft Voices**, download a character, and preview either alert. Downloads happen only when requested. Then enable **Sound notifications**. Automatic notifications require a host containing PR #685's optional activity APIs. Older hosts show an update message and still support downloads and manual previews.

Defaults: notifications off, Needs you on, idle off, volume 25%. Input alerts are limited to once every ten seconds across agents. Idle waits five seconds, then uses a global 30-second spacing (15/30/60 available). New agents seed silently; idle does not mean success. Pause suppresses new automatic alerts for 30 minutes. Manual previews still work while disabled or paused. Clips rotate without adjacent repeats when several are available, play one at a time, and stop after at most eight seconds. Input takes priority over idle.

Only one sound implementation should be enabled. Turn off Sound Studio notifications and any separate built-in chimes before enabling Warcraft Voices. Plugins have independent settings; installing a new one does not silently override another.

## Bring your own rules

Fork this folder, change the package name to give the plugin a unique ID, and install your copy. Change `policy.ts` for event timing, `runtime.ts` for background behavior, `player.ts` for playback, and `catalog.json` / `download.ts` for a curated source. For arbitrary local audio imports, start from Sound Studio's `plugins/agent-sounds` example instead.

There is no private host import, hook installer, audio daemon, shell command or PeonPing executable. The background script uses `experimental_observeAgents`, own-plugin realtime signals and a Web Lock to elect one player across main windows. Disable/reload releases the subscriptions, timers, audio and lock. Alerts continue while the plugin page is closed. The panel's manual preview stops on unmount.

Character audio and settings use the plugin SQLite database. Writes are serialized, queue admission is bounded, and downloads/removals commit together with selection changes. Failed or cancelled downloads do not persist partial characters. Only the selected character's audio crosses normal read RPCs.

## Audio and credits

Plugin source code: MIT, see `LICENSE.txt`. **Game audio is not included in the source or plugin bundle.** Characters download audio data from the official [PeonPing original packs](https://github.com/PeonPing/og-packs), pinned to revision `5d1245fe0188c8da775ca8875c32ee7bf8d92c57`. Each character's source, author, declared license, labels and SHA-256 checksums are recorded in `catalog.json` and linked in the UI.

The upstream pack manifests declare **CC-BY-NC-4.0**. Warcraft audio remains the property of its publisher; the plugin's MIT license does not grant rights to that audio. Review the source attribution and applicable rights before redistribution or commercial use.

Downloads are restricted to the pinned GitHub raw source, reject redirects and invalid paths, verify file signatures and SHA-256, and cap files at 1 MiB and each character at 2 MiB decoded (at most three lines per event). There is a 15-second deadline per request and cancellation on plugin disposal. No archive extraction or executable content is accepted.

## Develop and verify

```sh
npm install
npm test
npm run typecheck
npm run build
zcc plugin dev . --once
```

`npm test -- --coverage` enforces 80% statement, line, branch and function coverage. Tests use Node's built-in `node:sqlite` (Node 22.13+), without replacing any Electron native addon. Dependencies here are linked to the local checkout's published SDK facade for development; normal consumers can install the public package.

`zcc plugin build` refreshes the scaffold SDK declaration from the executing host. Typechecking uses the installed public SDK package declarations; use an SDK build containing the new activity APIs. The `types/` scaffold copy is retained for reference. Follow `LIVE_TEST.md` for actual app verification. No marketplace publication has been performed.
