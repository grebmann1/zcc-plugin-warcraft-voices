import type { ZccPluginApi } from '@zana-ai/zcc-plugin-sdk/server';
import { CATALOG, preferences, type Preferences, type SoundState, type VoicePack } from './model.js';
import { downloadCharacter } from './download.js';
export async function createPlugin(zcc: ZccPluginApi, download = downloadCharacter) {
  const db = zcc.storage.database();
  db.migrate([`CREATE TABLE IF NOT EXISTS preferences (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS voices (id TEXT PRIMARY KEY, data TEXT NOT NULL);`]);
  const controller = new AbortController(); zcc.onDispose(() => controller.abort());
  const saved = db.prepare('SELECT data FROM preferences WHERE id=1').get() as { data: string } | undefined;
  let config = preferences(saved ? JSON.parse(saved.data) : undefined);
  const load = (id: string): VoicePack | undefined => {
    const row = db.prepare('SELECT data FROM voices WHERE id=?').get(id) as { data: string } | undefined;
    return row ? JSON.parse(row.data) : undefined;
  };
  const view = (): SoundState => {
    const needsYou = load(config.needsYouPackId);
    const idle = config.idlePackId === config.needsYouPackId ? needsYou : load(config.idlePackId);
    return { preferences: config,
      installed: (db.prepare('SELECT id FROM voices LIMIT 4').all() as { id: string }[]).map(row => row.id),
      // Send only the assigned event clips, never the whole downloaded library.
      pack: needsYou || idle ? { id: config.packId, needsYou: needsYou?.needsYou ?? [], idle: idle?.idle ?? [] } : undefined };
  };
  let pending = Promise.resolve<unknown>(undefined), admitted = 0;
  type Change = { next: Preferences; pack?: VoicePack; remove?: string };
  const mutate = (change: () => Promise<Change> | Change) => {
    if (admitted >= 8) throw new Error('Voice settings are busy. Try again shortly.');
    admitted++;
    const work = pending.then(async () => {
      if (controller.signal.aborted) throw new Error('Plugin stopped.');
      const plan = await change();
      if (controller.signal.aborted) throw new Error('Plugin stopped.');
      db.transaction(() => {
        if (plan.pack) db.prepare('INSERT INTO voices(id,data) VALUES(?,?)').run(plan.pack.id, JSON.stringify(plan.pack));
        if (plan.remove) db.prepare('DELETE FROM voices WHERE id=?').run(plan.remove);
        db.prepare('INSERT INTO preferences(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify(plan.next));
      });
      config = plan.next; zcc.realtime.publish('changed', null); return view();
    }).finally(() => { admitted--; });
    pending = work.catch(() => undefined); return work;
  };
  zcc.rpc.method('read', view);
  zcc.rpc.method('configure', input => mutate(() => {
    const v = input && typeof input === 'object' ? input as Partial<Preferences> : {};
    for (const id of [v.packId, v.needsYouPackId, v.idlePackId]) {
      if (id !== undefined && (!CATALOG.some(c => c.id === id) || !load(id))) throw new Error('Download this character first.');
    }
    // Retain the legacy single-character RPC as an explicit "use for both" shortcut.
    const both = v.packId === undefined ? {} : { needsYouPackId: v.packId, idlePackId: v.packId };
    const next = preferences({ ...config, ...v, ...both, pausedUntil: config.pausedUntil });
    if ((next.enabled && next.needsYou || v.needsYou === true) && !load(next.needsYouPackId)?.needsYou.length
      || (next.enabled && next.idle || v.idle === true) && !load(next.idlePackId)?.idle.length) throw new Error('Download a character for this alert before enabling notifications.');
    return { next };
  }));
  zcc.rpc.method('pause', input => mutate(() => {
    if (typeof input !== 'boolean') throw new Error('Choose pause or resume.');
    return { next: { ...config, pausedUntil: input ? Date.now() + 30 * 60_000 : 0 } };
  }));
  zcc.rpc.method('install', input => mutate(async () => {
    const character = CATALOG.find(c => c.id === input);
    if (!character) throw new Error('Unknown Warcraft character.');
    // No archive extraction or executable installer. Only pinned, verified audio.
    const pack = load(character.id) ? undefined : await download(character, controller.signal);
    return { next: config, pack };
  }));
  zcc.rpc.method('remove', input => mutate(() => {
    if (typeof input !== 'string' || !load(input)) throw new Error('Character is not downloaded.');
    const needsYou = config.needsYou && config.needsYouPackId !== input;
    const idle = config.idle && config.idlePackId !== input;
    return { next: { ...config, needsYou, idle, enabled: config.enabled && (needsYou || idle) }, remove: input };
  }));
  zcc.rpc.method('preview', input => {
    const v = input as { id?: unknown; cue?: unknown } | null;
    if (!v || typeof v.id !== 'string' || !['idle','needs-you'].includes(String(v.cue))) throw new Error('Choose a character and alert.');
    const pack = load(v.id); if (!pack) throw new Error('Download this character first.');
    return pack;
  });
  zcc.log.info('Warcraft Voices loaded. Notifications start off.');
}
export default createPlugin;
