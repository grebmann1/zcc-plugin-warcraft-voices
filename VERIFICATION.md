# Verification — 2026-11-07

## Framework merge

[PR #685](https://github.com/salesforce/zana/pull/685) was squash-merged as `8d1a5f0234e4c08cdfbf6460a541bfdfc91e5b05`. All 20 PR checks passed on final head `5c731b12d4e02758adad416b812a8e20c5d2fdb0`; [main CI](https://github.com/salesforce/zana/actions/runs/42384184663) also completed successfully. Base `6f3922051e82309eb388d9d5877513ba04f15e87`. Normal pre-push checks passed: typecheck, 97 targeted tests and 331 guards. No gate skips. TinyNod was not opted in and no TinyNod review is claimed.

## Independent Warcraft plugin

- `npm test -- --coverage`: **46 tests pass** across seven files. Statements 97.41%, branches 92.17%, functions 94.68%, lines 100%. Model, download and server have 100% statement and branch coverage, including SQLite rollback, bounded queue admission, disposal during download, strict URL/checksum/signature/size validation, and download retry. Policy tests cover bursts of ten agents, baseline silence, priority, pause/resume and timer cleanup.
- `npm run typecheck`: passes against the public SDK declarations.
- `zcc plugin build .` and `zcc plugin dev . --once`: pass; backend running after reload.
- Real pinned upstream download verification passes for all four characters: Peon 3 input / 2 idle, 299,804 decoded bytes; Peasant 3 / 3, 423,620 bytes; Grunt 2 / 3, 227,046 bytes; Murloc 1 / 1, 140,708 bytes including its repeated shared clip. Smoke verification did not save these files in source.
- Built Electron authoring test: `pnpm test:e2e -- e2e/plugin-authoring-live.spec.ts` passes (49.5s in the initial combined invocation).
- Final plugin boundary test: `pnpm test:e2e -- e2e/warcraft-voices-plugin.spec.ts` passes (49.8s). It installs an external plugin copy in a private home, downloads pinned Peon audio through real backend fetch/RPC/SQLite, observes real Electron audio-state events, exercises pause/resume, enables alerts only in that private profile, checks panel-closed and hidden-window real agent transitions, second-window deduplication, renderer reload persistence, and pending-alert cleanup on disable/re-enable. Native screenshots were inspected for dark and narrow/light layouts.
- The Electron test first caught delayed checkbox feedback and panel-width overflow. Both product issues were fixed (optimistic settings with rollback and container queries) before the final passing run. No test assertion was weakened.

## Real running app

Installed at `/Users/grebmann/zcc-workspace/extensions/warcraft-voices` through `zcc plugin install`, registered as its own Project, and opened under **Plugins → Warcraft Voices**. Orc Peon was downloaded in the user's profile. Both real input and idle previews report played. Pause/resume works; character and settings survive several public build/reload cycles. A light-theme contrast issue found in the first native screenshot was fixed with the host's `--bg-panel` and `--text-muted` tokens; the reloaded panel was inspected again.

**Final real-profile state:** notifications off, Needs you on, idle off, volume 25%, spacing 30 seconds, unpaused, Peon selected/downloaded. The installed app lacks the merged automatic-activity APIs and shows the update message. Automatic alerts were proven in the freshly built private Electron app, not claimed on the older installed app. No installed-app replacement or restart was performed.

## Distribution and scope

MIT plugin code; no Warcraft audio bundled in the repository or source archive. Upstream attribution and manifest-declared CC-BY-NC-4.0 remain separate from code licensing. No hook/PeonPing executable was installed. The independent source repository has not been pushed or published to a marketplace. Its `verification/warcraft-voices-plugin.spec.ts` fixture is also placed in the local Zana checkout's `e2e/` for repeatable execution. The shared dirty core checkout, original branch and real index were preserved; no broad staging/reset was used.


## Settings migration — 2026-11-07

The follow-up placement change registers the generic `notificationSoundProvider`
slot, embeds controls in **Settings → Notifications → Sounds**, and leaves the
legacy panel URL unlisted. The host owns the selected provider and playback
master. Switching providers leaves playback off; Configure links inspect without
changing active playback. Older hosts retain manual Configure previews with
automatic playback off. Legacy plugin enabled preferences remain on disk, while
being mounted by the new host is the runtime playback authorization.

- Unit tests: 48 tests across seven files, statements 97.44%, branches 92.53%,
  functions 94.73%, lines 100%.
- Public consumer `npm run typecheck`: passed.
- `zcc plugin dev . --once`: rebuilt and reloaded the installed plugin successfully.
- Built Electron Settings/provider lifecycle test passed, including exclusive
  activation, real built-in cue suppression, Configure/search links, reload,
  disable and missing-provider silence.
- The migrated plugin boundary test passed (57.9s) in private built Electron,
  downloading real Peon audio, proving manual/background playback and cleanup.
  Sound Studio's migrated test passed alongside it (35.1s).
- Core authoring and packaged-provider tests passed in the earlier combined run.

Core evidence: `.zcc/verification/sound-settings-placement/` and
`e2e/.artifacts/runs/1794116652911-6230-8f13e438`. This Settings follow-up is a
local change and is not part of already-merged PR #685. The installed Zana host
needs an updated build for the new Settings destination; no host replacement or
restart was performed. The user's automatic-playback preferences were not changed.

## Independent voices by alert — 2026-11-08

Warcraft Voices now has independent Needs you and Idle character selectors and previews. Existing packId preferences migrate to the same character for both events. Downloads preserve assignments and event toggles; Use for both is an explicit shortcut. Removing an assigned character disables only the affected events and retains their assignments without fallback. The normal read response contains only the assigned event clips.

- 7 unit files / 54 tests passed with coverage: statements 97.55%, branches 93.33%, functions 95.14%, lines 100% (`.test-artifacts/mixed-voices-tests.log`).
- Public SDK consumer typecheck and root typecheck passed.
- `zcc plugin dev . --once` rebuilt and reloaded the installed plugin successfully (`.test-artifacts/mixed-voices-live-reload.log`). No real-user automatic-playback preferences were changed.
- The public authoring scenario passed in core run `1794150035590-50890-4fefc7fa`. The same run found an ambiguous E2E label selector; the test now targets the exact combobox.
- The corrected Warcraft built-Electron scenario passed in 44.0s in core run `1794150143117-59968-b8d7683d`. Real pinned Orc/Human downloads and Electron audio-state events were checked. SHA-256 hashes of the actual decoded manual and background playback clips matched Orc request and Human idle assignments. Mixed choices survived reload and plugin disable/re-enable; disposal stayed silent.
- Dark and narrow light screenshots were inspected; the focused mixed-assignment screenshot is `mixed-voice-assignments.png` in that run. The editable Current/Proposed mock is `.zcc/verification/mixed-warcraft-voices/index.html` in the core checkout.

Changes remain local and uncommitted. The new Settings destination still requires the updated host build; older installed hosts expose these plugin controls in Configure. No installed app replacement/restart, marketplace publication or merge was performed. TinyNod was not run (no push; not opted in on the core checkout).

## Warcraft interface — 2026-11-08

Replaced the plain Settings cards with a self-contained Warcraft-inspired dark stone/bronze interface. The palette stays dark within either host theme; original SVG crests distinguish the four characters. Alert cards stack at narrow widths, and the character roster remains bounded. Native voice selects were replaced by themed, viewport-confined portal menus with keyboard selection, typeahead, selected/disabled states, focus restoration and listener cleanup. The menu tracks scrolling/resizing without a focus-induced jump. No private host UI dependency, remote font or game image was added.

- `npm test -- --coverage`: 59 tests in 8 files passed. Statements 97.96%, branches 94.51%, functions 96%, lines 100%. The new picker has 100% statements/functions/lines and 98.83% branches. Evidence: `.test-artifacts/warcraft-theme-tests.log`.
- Public consumer typecheck and core typecheck passed. Public `zcc plugin dev . --once` rebuilt/reloaded the installed plugin; evidence `.test-artifacts/warcraft-theme-typecheck.log` and `warcraft-theme-reload.log`.
- The live installed plugin was opened through Plugins → Warcraft Voices → Settings. Its dark panel, distinct crests and all four downloaded choices were visible in the themed menu inside the light host. Escape dismissed the menu. Real user voice assignments, event toggles, volume and playback master were preserved.
- Public authoring built-Electron scenario passed (26.0s) in core run `1794151329346-11274-56ce4014`. That run exposed a product issue: a deferred ancestor scroll could immediately dismiss a narrow menu. The picker now prevents focus scrolling and follows ancestor scroll/resize; unit coverage was extended.
- Final dedicated built-Electron scenario passed (1.1m) in core run `1794151517045-30637-504b7fe2`, retaining real downloads, decoded clip identity checks, Electron audio events, background agent transitions, persistence and cleanup. Added keyboard selection, disabled-choice, Escape-focus, dark-palette-in-light-Settings and 390px portal geometry checks. Native dark, light/narrow and expanded-menu screenshots were inspected.
- Core evidence: `.zcc/verification/warcraft-theme/`; repeatable boundary fixture is in `verification/warcraft-voices-plugin.spec.ts` and the core `e2e/` copy. The Current/Warcraft clickable proposal is `.zcc/verification/warcraft-theme/index.html`. The desktop browser API was unavailable during this session; a proposal image was shown, followed by native live-app inspection and actual Electron screenshots.

All source changes remain local/uncommitted. Core base origin/main `28ae75f18d84e1e399a27ec38966bda72e04c12d`, head `d8814f237d2e0cae9ff88e48fa3924ad28578c6b`; plugin head `864ab953d15fd1c3153c02e2b25dd40a7768efa5`. No push or hook bypass occurred. TinyNod was not run: no push and not opted in. No TinyNod review is claimed. No host replacement/restart or marketplace publication occurred; older hosts still expose manual previews through Configure.

## GitHub release preparation — 2026-11-09

Version 0.2.0 declares `server.mjs` and `app.js` with committed SDK metadata, so Git installs need no local compiler or npm dependencies. No game audio is shipped.

A clean plugin copy installed the packed SDK from the matching public Zana source and public npm dependencies. All 59 unit tests passed, with 100% line coverage and 94.51% branch coverage; typecheck passed after adding the explicit Node type dependency. Compiled JavaScript passed Node syntax checks.

Built Electron integration on Zana sound-settings commit `9189ad843227d39e8d92796b48fa0e3b2979d899` passed the complete independent plugin test: pinned real character downloads, Orc Peon input / Human Peasant idle assignment, Chromium audio previews and automatic background alerts, pause/resume, persistence across reload, themed keyboard menus, narrow light-theme rendering, multi-window player exclusion and disposal. The test used an isolated home and left the user's settings unchanged.

Run the integration test from a compatible Zana checkout by copying `verification/warcraft-voices-plugin.spec.ts` into `e2e/`, setting `WARCRAFT_PLUGIN_SOURCE` to this plugin checkout, and running it with `pnpm test:e2e -- <copied-spec>`.

Published Git installation was then verified from `https://github.com/grebmann1/zcc-plugin-warcraft-voices.git` through the real built-Electron Git installer. The complete test passed in 29 seconds, using committed prebuilt runtime entries and downloading audio on demand.
