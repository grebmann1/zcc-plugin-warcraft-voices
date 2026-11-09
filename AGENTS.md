# warcraft-voices plugin

This is a Zana Command Center plugin. The manifest lives in `package.json` → `zcc`.
Id: `warcraft-voices`.

## Loop

```bash
zcc plugin install .
```

After install the plugin is live. Then, only as needed:

- `npm test` — unit tests, no running app.
- Backend edits: `zcc plugin reload warcraft-voices` (`zcc plugin dev` optional).
- UI (`zcc.app`) edits: `zcc plugin dev` (watch) or `zcc plugin build` then `reload`.
- Compile check: `zcc plugin build` (no running app).

`zcc plugin dev` is an optional watch loop **after** a path install. It is not required to create or run a plugin. The manifest declares precompiled JavaScript for Git installs. Build editable `server.ts` / `app.tsx` siblings before reloading a path install. A failed rebuild keeps the last good generation. Plugins are full-trust in-process on the server after install. Do not request host-daemon tokens.
Embedded Settings controls use natural height; the legacy panel fills its host slot. Skills live in `skills/<name>/SKILL.md`.
MCP servers belong in `zcc.mcpServers`. Author against `@zana-ai/zcc-plugin-sdk` (`definePluginApp`, `ZccPluginApi`).

The `definePluginApp` setup registers `app.slots.notificationSoundProvider`; Settings owns selection and the playback master. An unlisted nav panel preserves old URLs, and older hosts use a Configure section with manual previews only.
Needs you and Idle have independent character assignments. Existing packId settings migrate to both; downloading another character never changes assignments. Only assigned event clips cross read RPCs, and removal disables affected events without fallback.
The Settings UI owns a dark stone/bronze palette in either host theme. Keep styles scoped to `.warcraft-voices` and the body-portal `.wv-picker-popup`. `crest.tsx` contains original SVG artwork; `voice-picker.tsx` owns accessible keyboard selection and cleans up its portal/listeners. Do not depend on private host UI packages or remote images/fonts.
The server factory default-exports `(zcc) => { … }` and registers `zcc.rpc` methods the panel can call after a reload.

## Verify in running ZCC

Follow `LIVE_TEST.md` before claiming completion. Use `zcc plugin dev --once`
for an agent-controlled rebuild and reload without a background watcher.
A successful command checks backend health; it does not prove the UI rendered.
Open the plugin in ZCC with the available computer-use tool, exercise its controls, then change the source and verify the open panel updates.
Report what you observed and any blocked checks. Do not claim live verification from unit tests alone.
