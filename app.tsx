import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { definePluginApp, useRealtime, useRpc } from '@zana-ai/zcc-plugin-sdk/app';
import { CATALOG, createClipPicker, type Cue, type Preferences, type SoundState, type VoicePack } from './model.js';
import { mountBackground, runtimeStatus } from './runtime.js';
import { SoundPlayer } from './player.js';
import { styles } from './styles.js';

export function WarcraftVoices() {
  const rpc = useRpc();
  const [state, setState] = useState<SoundState>(), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [volume, setVolume] = useState<number | null>(null), [now, setNow] = useState(Date.now);
  const player = useRef<SoundPlayer | null>(null), picker = useRef(createClipPicker()), alive = useRef(true), revision = useRef(0), saving = useRef(false);
  const status = useSyncExternalStore(runtimeStatus.subscribe, runtimeStatus.get);
  const load = () => {
    const request = ++revision.current;
    void rpc.call<SoundState>('read').then(value => { if (alive.current && request === revision.current) setState(value); })
      .catch(error => { if (alive.current) setMessage(String(error)); });
  };
  useEffect(() => {
    alive.current = true; load();
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => { alive.current = false; clearInterval(timer); player.current?.stop(); };
  }, [rpc]);
  useRealtime('changed', load);
  async function action(method: string, input: unknown, success: string) {
    setBusy(true); setMessage(''); player.current?.stop(); ++revision.current;
    try {
      const value = await rpc.call<SoundState>(method, input);
      if (alive.current) { ++revision.current; setState(value); setNow(Date.now()); setMessage(success); }
      return true;
    } catch (error) { if (alive.current) setMessage(error instanceof Error ? error.message : String(error)); return false; }
    finally { if (alive.current) setBusy(false); }
  }
  const configure = async (patch: Partial<Preferences>) => {
    const before = state;
    setState(current => current ? { ...current, preferences: { ...current.preferences, ...patch } } : current);
    if (!await action('configure', patch, 'Settings saved.') && alive.current) setState(before);
  };
  async function saveVolume(value: number) {
    if (saving.current || value === state?.preferences.volume) return;
    saving.current = true;
    try { await configure({ volume: value }); } finally { saving.current = false; if (alive.current) setVolume(null); }
  }
  async function preview(id: string, cue: Cue) {
    setBusy(true); setMessage('');
    try {
      const pack = await rpc.call<VoicePack>('preview', { id, cue });
      if (!alive.current) return;
      const clip = picker.current(pack, cue);
      if (!clip) throw new Error('This character has no sound for that alert.');
      player.current ??= new SoundPlayer();
      await player.current.play(cue, state!.preferences.volume, clip);
      if (alive.current) setMessage(state!.preferences.volume === 0 ? 'Volume is muted.' : `${CATALOG.find(c => c.id === id)!.name} · ${cue === 'idle' ? 'Idle' : 'Needs you'} preview played.`);
    } catch (error) { if (alive.current) setMessage(error instanceof Error ? error.message : String(error)); }
    finally { if (alive.current) setBusy(false); }
  }
  if (!state) return <section className="warcraft-voices"><style>{styles}</style><div className="wv-inner"><h2>Warcraft Voices</h2><p role="status">{message || 'Loading characters…'}</p></div></section>;
  const p = state.preferences, paused = p.pausedUntil > now;
  return <section className="warcraft-voices" aria-label="Warcraft Voices"><style>{styles}</style><div className="wv-inner">
    <header><span className="wv-eyebrow">WARCRAFT VOICES · SOUND PLUGIN</span><h2>A little zug zug.<br/>A lot less babysitting.</h2><p>Give your agents a familiar voice. Keep a busy room quiet.</p></header>
    <div className="wv-card wv-master"><div><h3>Sound notifications</h3><p>{paused ? 'Paused for up to 30 minutes.' : p.enabled ? 'On for the alerts you choose below.' : 'Off. Download a character and try a preview.'}</p></div><button role="switch" aria-label="Sound notifications" aria-checked={p.enabled} disabled={busy || !state.pack} onClick={() => void configure({ enabled: !p.enabled })}>{p.enabled ? 'On' : 'Off'}</button></div>
    <div className="wv-section-title"><div><h3>Choose your character</h3><p>Download once. Play locally. Voice lines rotate.</p></div><span className="wv-badge">4 CHARACTERS</span></div>
    <div className="wv-characters">{CATALOG.map(character => {
      const installed = state.installed.includes(character.id), selected = installed && p.packId === character.id;
      return <article className={`wv-character ${selected ? 'wv-selected' : ''}`} key={character.id}>
        <span className="wv-sigil" aria-hidden="true">{character.sigil}</span><h4>{character.name}</h4><p>{selected ? 'Your active voice' : installed ? 'Ready to play' : 'Download to listen'}</p>
        <button className="wv-primary" aria-pressed={selected} disabled={busy || selected} onClick={() => void action(installed ? 'configure' : 'install', installed ? { packId: character.id } : character.id, `${character.name} selected.`)}>{selected ? 'Selected' : installed ? `Use ${character.name}` : `Download ${character.name}`}</button>
        <div className="wv-previews"><button aria-label={`Preview ${character.name} Needs you`} disabled={busy || !installed} onClick={() => void preview(character.id, 'needs-you')}>▷ Needs you</button><button aria-label={`Preview ${character.name} Idle`} disabled={busy || !installed} onClick={() => void preview(character.id, 'idle')}>▷ Idle</button></div>
        <div className="wv-character-footer"><a href={character.source} target="_blank" rel="noreferrer">Pack credits ↗</a>{installed && <button aria-label={`Remove ${character.name}`} disabled={busy} onClick={() => void action('remove', character.id, `${character.name} removed.`)}>Remove</button>}</div>
      </article>;
    })}</div>
    <div className="wv-card"><h3>Keep it calm</h3>
      <label className="wv-row"><span><strong>Needs you</strong><small>Input or approval requests. At most once every 10 seconds.</small></span><input type="checkbox" checked={p.needsYou} disabled={busy} onChange={event => void configure({ needsYou: event.target.checked })}/></label>
      <label className="wv-row"><span><strong>Becomes idle</strong><small>After 5 seconds at rest. Idle does not mean success.</small></span><input type="checkbox" checked={p.idle} disabled={busy} onChange={event => void configure({ idle: event.target.checked })}/></label>
      <div className="wv-row"><span><strong>Space out idle alerts</strong><small>Across all agents. No queue of overlapping voices.</small></span><div className="wv-segments" role="group" aria-label="Idle alert spacing">{[15, 30, 60].map(seconds => <button key={seconds} aria-pressed={p.idleSpacingSeconds === seconds} disabled={busy} onClick={() => void configure({ idleSpacingSeconds: seconds })}>{seconds}s</button>)}</div></div>
      <label className="wv-row"><span><strong>Volume · {volume ?? p.volume}%</strong></span><input type="range" aria-label="Sound volume" min="0" max="100" value={volume ?? p.volume} disabled={busy} onChange={event => setVolume(Number(event.target.value))} onPointerUp={event => void saveVolume(Number(event.currentTarget.value))} onKeyUp={event => void saveVolume(Number(event.currentTarget.value))} onBlur={event => void saveVolume(Number(event.currentTarget.value))}/></label>
      <div className="wv-row"><span><strong>{paused ? 'Taking a break' : 'Need a quiet stretch?'}</strong><small>{paused ? 'New alerts resume automatically. Previews still work.' : 'Pause automatic alerts for 30 minutes.'}</small></span><button disabled={busy} onClick={() => void action('pause', !paused, paused ? 'Automatic alerts resumed.' : 'Automatic alerts paused for 30 minutes.')}>{paused ? 'Resume now' : 'Pause 30 minutes'}</button></div>
    </div>
    <p className="wv-message" role="status">{busy ? 'Working…' : message}</p>
    <footer><span>{status}</span><p>Audio downloads come from <a href="https://github.com/PeonPing/og-packs" target="_blank" rel="noreferrer">PeonPing’s original packs</a>. Pack manifests declare CC BY-NC 4.0; Warcraft audio belongs to its publisher. No game audio is bundled with this plugin.</p><p>Enable one sound plugin at a time. Turn off Sound Studio notifications and any other chimes before using this voice.</p></footer>
  </div></section>;
}
export default definePluginApp(app => {
  app.slots.navPanel({ id: 'main', title: 'Warcraft Voices', icon: 'Swords', placement: 'extensions', component: WarcraftVoices });
  app.contentScripts.register({ id: 'notifications', mount: mountBackground });
});
