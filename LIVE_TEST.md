# Live verification: Warcraft Voices

Use the intended running Zana instance. Do not modify session credentials or installed-plugin records. Keep automatic notifications off in a user's real profile during verification.

1. Run `zcc status --json` and `zcc plugin install .` from this directory.
2. Open **Plugins → Warcraft Voices** in the running app. Confirm four characters and the off default. Download Orc Peon; check three input lines and two idle lines via the panel previews. Preview both alerts with notifications off. Check pause/resume and volume, then restore the starting values.
3. Make a visible source edit and run `zcc plugin dev . --once`. Confirm the already-open panel updates and the downloaded character and off preference survive. The command must return nonzero for build or unhealthy reload failures. Revert the temporary edit and reload once more.
4. For the background API and Electron seam, run the isolated built-app test from a Zana checkout with this sibling project at `../extensions/warcraft-voices`:
   `pnpm test:e2e -- e2e/warcraft-voices-plugin.spec.ts e2e/plugin-authoring-live.spec.ts`
   The test downloads real pinned Peon audio in its private home, observes Electron's audio-state events, triggers actual fake-provider agent transitions with the page closed, checks pause/reload and disable cleanup, and checks light/narrow layout. It never enables the user's real profile notifications.
5. Record unit coverage, typecheck, public build, live panel behavior and private Electron results. On an older installed host, record the automatic-alert update message; do not claim live automatic notifications worked there.

Keep the requested plugin installed. Use `zcc plugin logs warcraft-voices -n 30` for backend errors. No app replacement/restart or marketplace publishing is part of this verification.
