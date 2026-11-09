# Warcraft Voices

An independent Zana Command Center plugin. Orc Peon, Human Peasant, Orc Grunt and Murloc voice lines for agents that need input or become idle. The shared sound-plugin APIs and authoring documentation were merged in [Zana PR #685](https://github.com/salesforce/zana/pull/685); this plugin uses only the public SDK.

## Use

```sh
zcc plugin install git:https://github.com/grebmann1/zcc-plugin-warcraft-voices.git@v0.2.0
```

The repository includes compiled runtime files, so installing it needs no Node dependencies or build step.

Open **Settings → Notifications → Sounds**, select **Warcraft Voices**, download the characters you want, and choose **Needs you voice** and **Idle voice** separately. For example, choose **Orc Peon** for Needs you and **Human Peasant** for Idle. Turn on **Becomes idle** if you want idle notifications, and preview either alert. Downloads happen only when requested. Then enable **Play notification sounds**. Automatic notifications require a host supporting the `notificationSoundProvider` slot and optional activity APIs. Older hosts keep downloads and manual previews in the plugin Configure section, with automatic playback off.

Defaults: notifications off, Needs you on, idle off, volume 25%. Input alerts are limited to once every ten seconds across agents. Idle waits five seconds, then uses a global 30-second spacing (15/30/60 available). New agents seed silently; idle does not mean success. Pause suppresses new automatic alerts for 30 minutes. Manual previews still work while disabled or paused. Clips rotate without adjacent repeats when several are available, play one at a time, and stop after at most eight seconds. Input takes priority over idle.

The host runs one selected sound provider. Selecting Warcraft Voices turns playback off until explicitly enabled, and built-in chimes and other registered providers stay silent while it is active. Installing a plugin does not change the active provider. Legacy independent audio content scripts must migrate to this contract.

## Mix voices by alert

**Voices by alert** has separate character selectors and previews for input requests and idle alerts. Both can use the same character or different characters. Downloading another character does not change your assignments or turn an alert on. Each library card also has a **Use for both** shortcut, which changes both voice choices while preserving event toggles.

Existing single-character settings migrate to that character for both alerts. Removing an assigned character turns off only the affected alert types, retains their assignments, and never substitutes another voice. Choose a downloaded replacement and re-enable that alert when ready. Downloading the removed character again does not silently re-enable its alerts.

## Warcraft interface

The plugin keeps its own dark stone and bronze palette inside light or dark Settings. Original vector faction crests, compact alert cards and a bounded character roster give the controls a Warcraft-inspired appearance without remote fonts or game images. The themed voice menus support arrow keys, Home/End, typeahead, Enter/Space, Escape and Tab; downloaded voices are selectable and unavailable voices point to the character library. Menus render in a viewport-confined portal and release their listeners when closed or unmounted. Narrow panels stack the alert cards and character roster.

To reskin a fork, change `styles.ts` and `crest.tsx`. The voice menu lives in `voice-picker.tsx`; it uses React and the public plugin SDK without private host UI imports.

## Bring your own rules

Fork this folder, change the package name to give the plugin a unique ID, and install your copy. Change `policy.ts` for event timing, `runtime.ts` for background behavior, `player.ts` for playback, and `catalog.json` / `download.ts` for a curated source. For personal MP3, WAV or OGG files, use **Settings → Notifications → Sounds → Built-in sounds → Upload audio**; no plugin is required. Sound Studio in the Zana repository is an example for more advanced sound plugins.

There is no private host import, hook installer, audio daemon, shell command or PeonPing executable. The background script uses `experimental_observeAgents`, own-plugin realtime signals and a Web Lock to elect one player across main windows. Disable/reload releases the subscriptions, timers, audio and lock. Alerts continue while the plugin page is closed. The panel's manual preview stops on unmount.

Character audio and settings use the plugin SQLite database. Writes are serialized, queue admission is bounded, and downloads/removals commit together with selection changes. Failed or cancelled downloads do not persist partial characters. Only the clips assigned to the two alert types cross normal read RPCs; the downloaded library stays in storage.

## Audio and credits

Plugin source code: MIT, see `LICENSE.txt`. **Game audio is not included in the source or plugin bundle.** Characters download audio data from the official [PeonPing original packs](https://github.com/PeonPing/og-packs), pinned to revision `5d1245fe0188c8da775ca8875c32ee7bf8d92c57`. Each character's source, author, declared license, labels and SHA-256 checksums are recorded in `catalog.json` and linked in the UI.

The upstream pack manifests declare **CC-BY-NC-4.0**. Warcraft audio remains the property of its publisher; the plugin's MIT license does not grant rights to that audio. Review the source attribution and applicable rights before redistribution or commercial use.

Downloads are restricted to the pinned GitHub raw source, reject redirects and invalid paths, verify file signatures and SHA-256, and cap files at 1 MiB and each character at 2 MiB decoded (at most three lines per event). There is a 15-second deadline per request and cancellation on plugin disposal. No archive extraction or executable content is accepted.

## Develop and verify

The plugin SDK is not currently published on public npm. For development, build and pack it from a Zana checkout containing the notification sound provider API:

```sh
# In your Zana checkout (Node 22.13+, pnpm from packageManager):
pnpm install --frozen-lockfile
pnpm --filter @zana-ai/zcc-plugin-sdk build
pnpm --filter @zana-ai/zcc-plugin-sdk pack --pack-destination /tmp

# In this plugin checkout:
npm install --no-save /tmp/zana-ai-zcc-plugin-sdk-0.1.0.tgz
npm test -- --coverage
npm run typecheck
npm run build
# Optional, after a local path install:
zcc plugin dev . --once
```

`zcc` must come from the matching Zana installation or checkout. `zcc plugin build` compiles the editable `server.ts` and `app.tsx` siblings into the declared JavaScript entries and refreshes the scaffold SDK declarations. Commit `server.mjs`, `app.js` and their metadata when publishing a release; Git installs use these prebuilt entries. Do not commit downloaded game audio or your plugin database.

`npm test -- --coverage` enforces 80% statement, line, branch and function coverage. Tests use Node's built-in `node:sqlite`, without replacing any Electron native addon. Follow `LIVE_TEST.md` for actual app verification. This repository is distributed directly from GitHub; it is not listed in a marketplace.


## Settings placement

Select this plugin in **Settings → Notifications → Sounds**. The host master
controls automatic playback; selecting a provider leaves sounds off until you
explicitly enable them. The provider owns its clips, volume and alert policy.
Installed plugins retains installation/update/disable/removal controls and links
to Configure sounds. The old panel URL remains unlisted for existing bookmarks.
No other registered sound provider or built-in chimes plays while this provider
is active. Legacy independent content scripts must migrate to this contract.

The notificationSoundProvider slot requires a supporting Zana host. Older hosts
show controls in the plugin Configure section, keep previews available and leave
automatic audio off. Existing packs and preferences remain stored. The legacy
plugin enabled preference is retained for compatibility; the new host master is
the authority for provider runtime activation.
