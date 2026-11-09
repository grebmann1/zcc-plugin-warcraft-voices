import { cpSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { test, expect } from './fixtures/app.js';
import { stubNativeDialogs, stubOpenDialog } from './sdk/native-dialog.js';
import { captureElectronScreenshot } from './fixtures/native-screenshot.js';

test.use({ launchEnv: { ZCC_FAKE_PROVIDER: '1' }, initialConfig: { sponsorPromptDismissed: true } });

test('independent Warcraft plugin mixes verified voices by alert, previews, pauses, reloads and disposes in built Electron', async ({ app, home }, info) => {
  test.setTimeout(180_000);
  const win = app.window, source = join(home, 'warcraft-plugin');
  cpSync(resolve(process.env.WARCRAFT_PLUGIN_SOURCE ?? '../extensions/warcraft-voices'), source, { recursive: true, filter: path => !['node_modules', 'coverage', '.git', '.test-artifacts'].some(part => path.split('/').includes(part)) });
  await stubOpenDialog(app.electron, [[source]]); await stubNativeDialogs(app.electron, [0, 0, 0]);
  expect(await win.evaluate(() => window.cc.extensions.install({ kind: 'localDir' }))).toMatchObject({ ok: true });
  await expect.poll(() => win.evaluate(async () => (await window.cc.pluginApps.list()).find(p => p.id === 'warcraft-voices')?.status)).toBe('running');
  const route = async (path: string) => { await win.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }, path); };
  await route('/settings/notifications');
  await win.getByRole('button', { name: 'Sound provider' }).click();
  await win.getByRole('option', { name: /^Warcraft Voices/ }).click();
  await expect(win.locator('.warcraft-voices').getByRole('heading', { name: 'Warcraft Voices', exact: true })).toBeVisible();
  await expect(win.getByRole('switch', { name: 'Play notification sounds' })).toHaveAttribute('aria-checked', 'false');
  await app.electron.evaluate(({ app, webContents }) => {
    (globalThis as any).__studioAudible = [];
    const watch = (contents: Electron.WebContents) => contents.on('audio-state-changed', event => {
      if (event.audible) (globalThis as any).__studioAudible.push(contents.id);
    });
    for (const contents of webContents.getAllWebContents()) watch(contents);
    app.on('web-contents-created', (_event, contents) => { watch(contents); });
  });
  const audible = () => app.electron.evaluate(() => (globalThis as any).__studioAudible as number[]);
  const captureDecodedClips = () => win.evaluate(() => {
    (globalThis as any).__mixedDecoded = [];
    const decode = AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData = function (data, ...args) {
      const bytes = new Uint8Array(data.slice(0));
      void crypto.subtle.digest('SHA-256', bytes).then(hash => {
        (globalThis as any).__mixedDecoded.push(Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join(''));
      });
      return decode.call(this, data, ...args);
    };
  });
  const decoded = () => win.evaluate(() => (globalThis as any).__mixedDecoded as string[]);
  await win.getByRole('button', { name: 'Download Orc Peon' }).click();
  await expect(win.getByRole('status')).toContainText('Orc Peon downloaded.', { timeout: 60_000 });
  await win.getByRole('button', { name: 'Download Human Peasant' }).click();
  await expect(win.getByRole('status')).toContainText('Human Peasant downloaded.', { timeout: 60_000 });
  await expect(win.getByRole('combobox', { name: 'Needs you voice', exact: true })).toContainText('Orc Peon');
  await expect(win.getByRole('combobox', { name: 'Idle voice', exact: true })).toContainText('Orc Peon');
  await win.getByRole('combobox', { name: 'Idle voice', exact: true }).click();
  const voices = win.getByRole('listbox', { name: 'Idle voice', exact: true });
  await expect(voices).toBeVisible();
  await expect(voices.getByRole('option', { name: /Orc Grunt/ })).toHaveAttribute('aria-disabled', 'true');
  await voices.press('ArrowDown'); await voices.press('Enter');
  await expect(voices).toHaveCount(0);
  await expect(win.getByRole('combobox', { name: 'Idle voice', exact: true })).toContainText('Human Peasant');
  await expect(win.getByRole('combobox', { name: 'Idle voice', exact: true })).toBeEnabled();
  const downloaded = await win.evaluate(() => window.cc.pluginApps.callRpc('warcraft-voices', 'read')) as any;
  expect(downloaded.pack.needsYou).toHaveLength(3); expect(downloaded.preferences.enabled).toBe(false);
  expect(downloaded.preferences).toMatchObject({ needsYouPackId: 'peon', idlePackId: 'peasant' });
  expect(downloaded.pack.needsYou[0].base64.length).toBeGreaterThan(1000);
  const hashes = (clips: any[]) => clips.map(clip => createHash('sha256').update(Buffer.from(clip.base64, 'base64')).digest('hex'));
  const orcRequests = hashes(downloaded.pack.needsYou), humanIdle = hashes(downloaded.pack.idle);
  await captureDecodedClips();
  await win.getByRole('button', { name: 'Preview Needs you voice' }).click(); await expect.poll(audible).toHaveLength(1);
  await expect.poll(async () => orcRequests.includes((await decoded())[0]!)).toBe(true);
  await expect.poll(() => app.electron.evaluate(({ webContents }) => webContents.getAllWebContents().every(contents => !contents.isCurrentlyAudible()))).toBe(true);
  await win.getByRole('button', { name: 'Preview Idle voice' }).click(); await expect.poll(audible).toHaveLength(2);
  await expect.poll(async () => humanIdle.includes((await decoded())[1]!)).toBe(true);
  await win.getByRole('button', { name: 'Pause 30 minutes' }).click(); await expect(win.getByRole('button', { name: 'Resume now' })).toBeVisible();
  await win.getByRole('button', { name: 'Resume now' }).click(); await expect(win.getByRole('button', { name: 'Pause 30 minutes' })).toBeVisible();
  await win.getByRole('switch', { name: 'Play notification sounds' }).click();
  await expect(win.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await win.getByRole('checkbox', { name: /Becomes idle/ }).check();
  await expect.poll(() => win.evaluate(() => window.cc.pluginApps.callRpc('warcraft-voices', 'read').then((v: any) => v.preferences.idle))).toBe(true);
  await expect(win.getByRole('checkbox', { name: /Becomes idle/ })).toBeEnabled();
  await expect(win.getByText('Notification player ready', { exact: true })).toBeVisible();
  const settleScreenshot = () => win.evaluate(async () => {
    document.querySelector('.settings-panel')?.scrollTo({ top: 0, behavior: 'instant' });
    for (const animation of document.getAnimations()) animation.finish();
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await settleScreenshot();
  await captureElectronScreenshot(app.electron, win, info.outputPath('warcraft-voices.png'));
  await win.getByRole('heading', { name: 'Voices by alert' }).evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await captureElectronScreenshot(app.electron, win, info.outputPath('mixed-voice-assignments.png'));
  await win.getByRole('combobox', { name: 'Needs you voice', exact: true }).click();
  await expect(win.getByRole('listbox', { name: 'Needs you voice', exact: true })).toBeVisible();
  await captureElectronScreenshot(app.electron, win, info.outputPath('warcraft-voice-menu.png'));
  await win.getByRole('listbox').press('Escape');
  await expect(win.getByRole('combobox', { name: 'Needs you voice', exact: true })).toBeFocused();
  await win.evaluate(async () => { await window.cc.config.set({ theme: 'light' }); document.querySelector<HTMLElement>('.warcraft-voices')!.style.width = '390px'; });
  await expect.poll(() => win.evaluate(() => { const panel = document.querySelector<HTMLElement>('.warcraft-voices')!; return panel.scrollWidth <= panel.clientWidth + 1; })).toBe(true);
  await settleScreenshot();
  expect(await win.locator('.warcraft-voices').evaluate(node => getComputedStyle(node).color)).toBe('rgb(238, 228, 206)');
  await win.getByRole('combobox', { name: 'Idle voice', exact: true }).click();
  const narrowMenu = win.getByRole('listbox', { name: 'Idle voice', exact: true });
  await expect(narrowMenu).toBeVisible();
  expect(await narrowMenu.evaluate(node => { const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; })).toBe(true);
  await captureElectronScreenshot(app.electron, win, info.outputPath('warcraft-voices-narrow-light.png'));
  await narrowMenu.press('Escape');
  await win.evaluate(async () => { await window.cc.config.set({ theme: 'dark' }); document.querySelector<HTMLElement>('.warcraft-voices')!.style.width = ''; });
  // A second scoped window must not play another copy or steal the player lock.
  const path = join(home, 'sound-project'); mkdirSync(path);
  const projectId = await win.evaluate(async path => { const result = await window.cc.projects.add(path); if (!result.ok) throw new Error(result.message); return result.value.id; }, path);
  await win.evaluate(id => window.cc.windows.openProject(id), projectId);
  await route('/inbox');
  await win.reload(); await route('/settings/notifications');
  await expect(win.getByText('Notification player ready', { exact: true })).toBeVisible();
  await expect(win.getByRole('combobox', { name: 'Needs you voice', exact: true })).toContainText('Orc Peon');
  await expect(win.getByRole('combobox', { name: 'Idle voice', exact: true })).toContainText('Human Peasant');
  await route('/inbox');
  await captureDecodedClips();
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
  await expect.poll(async () => humanIdle.includes((await decoded())[0]!)).toBe(true);
  const question = Buffer.from(JSON.stringify({ questions: [{ question: 'Review this?', options: ['Continue', 'Review'] }] })).toString('base64url');
  await request(`call_tool:ask_user_question tool_args:${question}`); await expect.poll(async () => (await audible()).length).toBe(beforeIdle + 2);
  await expect.poll(async () => orcRequests.includes((await decoded())[1]!)).toBe(true);
  // Disable the plugin itself. A pending stable-idle timer must be disposed.
  await request('delay:700 disable pending idle'); await win.waitForTimeout(1500);
  expect(await win.evaluate(() => window.cc.pluginApps.setEnabled('warcraft-voices', false))).toMatchObject({ ok: true });
  const beforeDisabled = (await audible()).length; await win.waitForTimeout(6000); expect((await audible()).length).toBe(beforeDisabled);
  expect(await win.evaluate(() => window.cc.pluginApps.setEnabled('warcraft-voices', true))).toMatchObject({ ok: true });
  await route('/settings/notifications'); await expect(win.getByText('Notification player ready', { exact: true })).toBeVisible();
  await expect(win.getByRole('combobox', { name: 'Needs you voice', exact: true })).toContainText('Orc Peon');
  await expect(win.getByRole('combobox', { name: 'Idle voice', exact: true })).toContainText('Human Peasant');
});
