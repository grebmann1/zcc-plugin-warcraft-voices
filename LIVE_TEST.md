# Live verification: Warcraft Voices

Use the intended running Zana instance. Do not modify session credentials or installed-plugin records. Keep automatic notifications off in a user's real profile during verification.

1. Run `zcc status --json` and `zcc plugin install .` from this directory.
2. Open **Settings → Notifications → Sounds**, then select **Warcraft Voices** in the running app. On older hosts, use the plugin Configure section for manual previews. Confirm four characters and the off default; switching providers must leave automatic playback off. Download Orc Peon and Human Peasant; downloading must not change the current assignments. Set **Needs you voice** to Orc Peon and **Idle voice** to Human Peasant. Preview each assigned voice with notifications off, then enable Becomes idle explicitly. Confirm that Use for both changes both assignments, and that removing an assigned character disables only its affected alert types without selecting a replacement. Restore the mixed assignments for background verification. Check pause/resume and volume, then restore the starting values.
3. Make a visible source edit and run `zcc plugin dev . --once`. Confirm the already-open panel updates and the downloaded character and off preference survive. The command must return nonzero for build or unhealthy reload failures. Revert the temporary edit and reload once more.
4. For the background API and Electron seam, run the isolated built-app test from a Zana checkout with this sibling project at `../extensions/warcraft-voices`:
   `pnpm test:e2e -- e2e/warcraft-voices-plugin.spec.ts e2e/plugin-authoring-live.spec.ts`
   The test downloads real pinned Peon and Peasant audio, checks decoded clip hashes for both manual previews and background events, and preserves mixed assignments over reload. In its private home, it observes Electron's audio-state events, triggers actual fake-provider agent transitions with the page closed, checks pause/reload and disable cleanup, and checks light/narrow layout. It never enables the user's real profile notifications.
5. Check the dark stone/bronze interface inside both light and dark Settings. Open each voice menu, use arrow keys and Enter, dismiss with Escape, and confirm focus returns to its trigger. Unavailable voices remain disabled. At 390px width, confirm no horizontal overflow and that the portal stays inside the viewport. Close/unmount the plugin with a menu open and confirm it disappears.
6. Record unit coverage, typecheck, public build, live panel behavior and private Electron results. On an older installed host, record the automatic-alert update message; do not claim live automatic notifications worked there.

Keep the requested plugin installed. Use `zcc plugin logs warcraft-voices -n 30` for backend errors. No app replacement/restart or marketplace publishing is part of this verification.

For a published Git install, set `WARCRAFT_PLUGIN_GIT_URL=https://github.com/grebmann1/zcc-plugin-warcraft-voices.git` when running the copied verification spec. This exercises the host's Git installer and committed JavaScript bundles instead of a local source directory.
