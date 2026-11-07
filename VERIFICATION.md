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
