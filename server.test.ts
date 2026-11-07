import { afterEach, expect, it, vi } from 'vitest';
import { createPlugin } from './server.js';
import { DEFAULTS, type SoundState } from './model.js';
import { wired, clip } from './test-host.js';
const hosts: ReturnType<typeof wired>[] = [];
const download = vi.fn(async (character: { id: string }) => ({ id: character.id, needsYou: [clip], idle: [clip] }));
afterEach(async () => { for (const host of hosts.splice(0)) { await host.harness.dispose(); host.close(); } vi.restoreAllMocks(); download.mockClear(); });
async function setup() { const host = wired(); hosts.push(host); await createPlugin(host.zcc, download); return { ...host, rpc: host.harness.callRpc }; }
it('starts silent, installs once, selects and previews independently, pauses, persists and removes', async () => {
  const host = await setup(), rpc = host.rpc;
  expect(await rpc('read')).toEqual({ preferences: DEFAULTS, installed: [], pack: undefined });
  await expect(rpc('configure', { enabled: true })).rejects.toThrow('Download');
  await rpc('install', 'peon'); await rpc('install', 'peon'); expect(download).toHaveBeenCalledTimes(1);
  await rpc('configure', { enabled: true, volume: 1000 }); await rpc('install', 'peasant');
  expect(await rpc('preview', { id: 'peon', cue: 'needs-you' })).toMatchObject({ id: 'peon' });
  expect(await rpc('read')).toMatchObject({ preferences: { packId: 'peasant', volume: 100 } });
  await rpc('configure', { packId: 'peon' }); await rpc('pause', true);
  const state = await rpc('read') as SoundState; expect(state.preferences.pausedUntil).toBeGreaterThan(Date.now());
  await rpc('configure', { pausedUntil: 0 }); expect((await rpc('read') as SoundState).preferences.pausedUntil).toBe(state.preferences.pausedUntil);
  await rpc('pause', false); await createPlugin(host.zcc, download);
  expect(await rpc('read')).toMatchObject({ preferences: { enabled: true, pausedUntil: 0 }, installed: ['peasant','peon'] });
  await rpc('remove', 'peasant'); expect(await rpc('read')).toMatchObject({ preferences: { enabled: true } });
  await rpc('remove', 'peon'); expect(await rpc('read')).toMatchObject({ preferences: { enabled: false }, installed: [] });
});
it('rejects invalid commands without changing durable state', async () => {
  const { rpc } = await setup();
  for (const [method, input] of [['install', '../escape'], ['install', null], ['configure', { packId: 'missing' }], ['remove', 1], ['remove','peon'], ['preview',null], ['preview',{ id: 'peon', cue: 'oops' }], ['preview',{ id: 'peon', cue: 'idle' }], ['pause', 'yes']]) await expect(rpc(method as string, input)).rejects.toThrow();
  await rpc('configure', null); expect(await rpc('read')).toMatchObject({ preferences: DEFAULTS, installed: [] });
});
it('rolls back audio insertion, removal and selection when preferences fail, then recovers', async () => {
  const { rpc, zcc } = await setup(), db = zcc.storage.database();
  db.runScript("CREATE TRIGGER fail_save BEFORE INSERT ON preferences BEGIN SELECT RAISE(ABORT, 'disk full'); END;");
  await expect(rpc('install', 'peon')).rejects.toThrow('disk full'); expect(await rpc('read')).toMatchObject({ installed: [], preferences: DEFAULTS });
  db.runScript('DROP TRIGGER fail_save'); await rpc('install', 'peon');
  db.runScript("CREATE TRIGGER fail_save BEFORE INSERT ON preferences BEGIN SELECT RAISE(ABORT, 'disk full'); END;");
  await expect(rpc('remove', 'peon')).rejects.toThrow('disk full'); expect(await rpc('read')).toMatchObject({ installed: ['peon'], pack: { id: 'peon' } });
  db.runScript('DROP TRIGGER fail_save');
  await Promise.all([rpc('configure', { volume: 42 }), rpc('configure', { idle: true })]);
  expect(await rpc('read')).toMatchObject({ preferences: { volume: 42, idle: true } });
});
it('does not save a failed download and can retry', async () => {
  const { rpc } = await setup(); download.mockRejectedValueOnce(new Error('network failed'));
  await expect(rpc('install', 'peon')).rejects.toThrow('network failed'); expect(await rpc('read')).toMatchObject({ installed: [] });
  await rpc('install', 'peon'); expect(await rpc('read')).toMatchObject({ installed: ['peon'] });
});
it('bounds queued mutations and cancels a download without committing after disposal', async () => {
  const { rpc, harness, zcc } = await setup();
  let resolve!: (pack: Awaited<ReturnType<typeof download>>) => void;
  download.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const running = rpc('install', 'peon');
  for (let i = 0; i < 8; i++) await Promise.resolve();
  const queued = Array.from({ length: 7 }, () => rpc('configure', { volume: 20 }));
  await expect(rpc('configure', {})).rejects.toThrow('busy');
  const outcomes = Promise.allSettled([running, ...queued]);
  await harness.dispose(); resolve({ id: 'peon', needsYou: [clip], idle: [] });
  expect((await outcomes).every(r => r.status === 'rejected')).toBe(true);
  expect(zcc.storage.database().prepare('SELECT * FROM voices').all()).toEqual([]);
});
