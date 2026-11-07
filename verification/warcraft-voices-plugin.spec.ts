import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test, expect } from './fixtures/app.js';
import { stubNativeDialogs, stubOpenDialog } from './sdk/native-dialog.js';
import { captureElectronScreenshot } from './fixtures/native-screenshot.js';

test.use({ launchEnv: { ZCC_FAKE_PROVIDER: '1' }, initialConfig: { sponsorPromptDismissed: true } });

test('independent Warcraft plugin downloads verified voices, previews, pauses, reloads and disposes in built Electron', async ({ app, home }, info) => {
  test.setTimeout(150_000);
  const win = app.window, source = join(home, 'warcraft-plugin');
  cpSync(resolve('../extensions/warcraft-voices'), source, { recursive: true, filter: path => !['node_modules', 'coverage', '.git', '.test-artifacts'].some(part => path.split('/').includes(part)) });
  // Record the real generic SDK feed in the fixture copy; no synthetic status events.
  const entry = join(source, 'app.tsx');
  writeFileSync(entry, readFileSync(entry, 'utf8').replace('mount: mountBackground', `mount: context => {
    const off = context.experimental_observeAgents?.(snapshot => {
      const root = globalThis as any;
      (root.__studioActivity ??= []).push(snapshot);
      root.__studioActivity = root.__studioActivity.slice(-20);
    });
    const dispose = mountBackground(context);
    return () => { off?.(); dispose(); };
  }`));
  await stubOpenDialog(app.electron, [[source]]); await stubNativeDialogs(app.electron, [0, 0, 0]);
  expect(await win.evaluate(() => window.cc.extensions.install({ kind: 'localDir' }))).toMatchObject({ ok: true });
  await expect.poll(() => win.evaluate(async () => (await window.cc.pluginApps.list()).find(p => p.id === 'warcraft-voices')?.status)).toBe('running');
  const route = async (path: string) => { await win.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }, path); };
  await route('/extensions/pages/warcraft-voices/main');
  await expect(win.getByRole('heading', { name: /A little zug zug/ })).toBeVisible();
  await expect(win.getByText('Notification player ready', { exact: true })).toBeVisible();
  await expect(win.getByRole('switch', { name: 'Sound notifications' })).toHaveAttribute('aria-checked', 'false');
  await app.electron.evaluate(({ app, webContents }) => {
    (globalThis as any).__studioAudible = [];
    const watch = (contents: Electron.WebContents) => contents.on('audio-state-changed', event => {
      if (event.audible) (globalThis as any).__studioAudible.push(contents.id);
    });
    for (const contents of webContents.getAllWebContents()) watch(contents);
    app.on('web-contents-created', (_event, contents) => { watch(contents); });
  });
  const audible = () => app.electron.evaluate(() => (globalThis as any).__studioAudible as number[]);
  await win.getByRole('button', { name: 'Download Orc Peon' }).click();
  await expect(win.getByRole('status')).toContainText('Orc Peon selected.', { timeout: 60_000 });
  const downloaded = await win.evaluate(() => window.cc.pluginApps.callRpc('warcraft-voices', 'read')) as any;
  expect(downloaded.pack.needsYou).toHaveLength(3); expect(downloaded.preferences.enabled).toBe(false);
  expect(downloaded.pack.needsYou[0].base64.length).toBeGreaterThan(1000);
  await win.getByRole('button', { name: 'Preview Orc Peon Needs you' }).click(); await expect.poll(audible).toHaveLength(1);
  await win.getByRole('button', { name: 'Pause 30 minutes' }).click(); await expect(win.getByRole('button', { name: 'Resume now' })).toBeVisible();
  await win.getByRole('button', { name: 'Resume now' }).click(); await expect(win.getByRole('button', { name: 'Pause 30 minutes' })).toBeVisible();
  await win.getByRole('switch', { name: 'Sound notifications' }).click();
  await expect(win.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await win.getByRole('checkbox', { name: /Becomes idle/ }).check();
  await expect.poll(() => win.evaluate(() => window.cc.pluginApps.callRpc('warcraft-voices', 'read').then((v: any) => v.preferences.idle))).toBe(true);
  await captureElectronScreenshot(app.electron, win, info.outputPath('warcraft-voices.png'));
  await win.evaluate(async () => { await window.cc.config.set({ theme: 'light' }); document.querySelector<HTMLElement>('.warcraft-voices')!.style.width = '390px'; });
  await expect.poll(() => win.evaluate(() => { const panel = document.querySelector<HTMLElement>('.warcraft-voices')!; return panel.scrollWidth <= panel.clientWidth + 1; })).toBe(true);
  await captureElectronScreenshot(app.electron, win, info.outputPath('warcraft-voices-narrow-light.png'));
  await win.evaluate(async () => { await window.cc.config.set({ theme: 'dark' }); document.querySelector<HTMLElement>('.warcraft-voices')!.style.width = ''; });
  // A second scoped window must not play another copy or steal the player lock.
  const path = join(home, 'sound-project'); mkdirSync(path);
  const projectId = await win.evaluate(async path => { const result = await window.cc.projects.add(path); if (!result.ok) throw new Error(result.message); return result.value.id; }, path);
  await win.evaluate(id => window.cc.windows.openProject(id), projectId);
  await route('/inbox');
  await win.reload(); await route('/extensions/pages/warcraft-voices/main');
  await expect(win.getByText('Notification player ready', { exact: true })).toBeVisible();
  await route('/inbox');
  await win.evaluate(() => {
    const Context = window.AudioContext;
    (window as any).__studioContexts = [];
    window.AudioContext = class extends Context { constructor(options?: AudioContextOptions) { super(options); (window as any).__studioContexts.push(this); } };
  });
  await app.electron.evaluate(({ BrowserWindow }) => { for (const window of BrowserWindow.getAllWindows()) window.hide(); });
  const request = async (input: string) => win.evaluate(async ({ projectId, input }) => {
    const result = await fetch('/api/v1/threads', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projectId, providerId: 'fake', input }) });
    if (!result.ok) throw new Error(await result.text()); return result.json();
  }, { projectId, input });
  const beforeIdle = (await audible()).length;
  await request('delay:700 sound plugin idle');
  try {
    await expect.poll(async () => (await audible()).length, { timeout: 15_000 }).toBe(beforeIdle + 1);
  } catch (error) {
    console.log('Sound Studio diagnostics:', JSON.stringify(await win.evaluate(() => ({ activity: (window as any).__studioActivity, audio: (window as any).__studioContexts.map((c: AudioContext) => ({ state: c.state, time: c.currentTime })) }))));
    throw error;
  }
  const question = Buffer.from(JSON.stringify({ questions: [{ question: 'Review this?', options: ['Continue', 'Review'] }] })).toString('base64url');
  await request(`call_tool:ask_user_question tool_args:${question}`); await expect.poll(async () => (await audible()).length).toBe(beforeIdle + 2);
  // Disable the plugin itself. A pending stable-idle timer must be disposed.
  await request('delay:700 disable pending idle'); await win.waitForTimeout(1500);
  expect(await win.evaluate(() => window.cc.extensions.setEnabled('warcraft-voices', false))).toMatchObject({ ok: true });
  const beforeDisabled = (await audible()).length; await win.waitForTimeout(6000); expect((await audible()).length).toBe(beforeDisabled);
  expect(await win.evaluate(() => window.cc.extensions.setEnabled('warcraft-voices', true))).toMatchObject({ ok: true });
  await route('/extensions/pages/warcraft-voices/main'); await expect(win.getByText('Notification player ready', { exact: true })).toBeVisible();
  await expect(win.getByRole('button', { name: 'Selected', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
