import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { definePluginApp, useRealtime, useRpc } from '@zana-ai/zcc-plugin-sdk/app';
import { CATALOG, createClipPicker, type Cue, type Preferences, type SoundState, type VoicePack } from './model.js';
import { mountBackground, runtimeStatus } from './runtime.js';
import { SoundPlayer } from './player.js';
import { styles } from './styles.js';
import { Crest, faction } from './crest.js';
import { VoicePicker } from './voice-picker.js';

export function WarcraftVoices({ embedded = false }: { embedded?: boolean } = {}) {
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
  if (!state) return <section className={`warcraft-voices${embedded ? ' warcraft-voices--embedded' : ''}`}><style>{styles}</style><div className="wv-inner">{!embedded && <h2>Warcraft Voices</h2>}<p role="status">{message || 'Loading characters…'}</p></div></section>;
  const p = state.preferences, paused = p.pausedUntil > now;
  const canEnable = (!p.needsYou || state.installed.includes(p.needsYouPackId)) && (!p.idle || state.installed.includes(p.idlePackId)) && (p.needsYou || p.idle);
  return <section className={`warcraft-voices${embedded ? ' warcraft-voices--embedded' : ''}`} aria-label="Warcraft Voices"><style>{styles}</style><div className="wv-inner">
    <header className="wv-banner"><Crest/><div className="wv-banner-copy"><span className="wv-eyebrow">YOUR AGENTS. THEIR ORDERS.</span><h2>Warcraft Voices</h2><p>Ready to work. Whenever you need them.</p></div><span className="wv-banner-status">{state.installed.length} / {CATALOG.length} VOICES READY</span></header>
    {!embedded && <div className="wv-card wv-master"><div><h3>Sound notifications</h3><p>{paused ? 'Paused for up to 30 minutes.' : p.enabled ? 'On for the alerts you choose below.' : 'Off. Download a character and try a preview.'}</p></div><button role="switch" aria-label="Sound notifications" aria-checked={p.enabled} disabled={busy || !p.enabled && !canEnable} onClick={() => void configure({ enabled: !p.enabled })}>{p.enabled ? 'On' : 'Off'}</button></div>}
    <div className="wv-card"><div className="wv-card-heading"><div><h3>Voices by alert</h3><p>Choose who answers the call.</p></div><span className="wv-section-number" aria-hidden="true">I</span></div><div className="wv-events">
      {([{ cue: 'needs-you', label: 'Needs you', voice: 'Needs you voice', toggle: 'needsYou', selection: 'needsYouPackId', help: 'Input or approval requests. At most once every 10 seconds.' },
        { cue: 'idle', label: 'Becomes idle', voice: 'Idle voice', toggle: 'idle', selection: 'idlePackId', help: 'After 5 seconds at rest. Idle does not mean success.' }] as const).map(event => {
        const id = p[event.selection], installed = state.installed.includes(id);
        return <div className="wv-event" key={event.cue}>
          <label className="wv-row"><span><strong>{event.label}</strong><small>{event.help}</small></span><input type="checkbox" checked={p[event.toggle]} disabled={busy || !installed && !p[event.toggle]} onChange={e => void configure({ [event.toggle]: e.target.checked })}/></label>
          <div className="wv-voice-controls"><VoicePicker label={event.voice} disabled={busy || !state.installed.length} value={id} installed={state.installed} onChange={value => void configure({ [event.selection]: value })}/><button className="wv-preview-assigned" aria-label={`Preview ${event.voice}`} disabled={busy || !installed} onClick={() => void preview(id, event.cue)}><span aria-hidden="true">▷</span>Preview</button></div>
        </div>;
      })}
    </div></div>
    <div className="wv-section-title"><div><h3>Character library</h3><p>Download once. Mix voices across your alerts.</p></div><span className="wv-badge">THE ROSTER · {CATALOG.length} CHARACTERS</span></div>
    <div className="wv-characters">{CATALOG.map(character => {
      const installed = state.installed.includes(character.id), needsYou = p.needsYouPackId === character.id, idle = p.idlePackId === character.id, selected = installed && needsYou && idle;
      return <article className={`wv-character wv-character--${character.id} ${selected ? 'wv-selected' : ''}`} key={character.id}>
        <Crest id={character.id}/><span className="wv-faction-label">{faction(character.id)}</span><h4>{character.name}</h4><p>{!installed ? 'Download to listen' : selected ? 'Needs you + Idle' : needsYou ? 'Needs you' : idle ? 'Idle' : 'Ready to play'}</p>
        <button className="wv-primary" aria-pressed={selected} disabled={busy || selected} onClick={() => void action(installed ? 'configure' : 'install', installed ? { packId: character.id } : character.id, `${character.name} ${installed ? 'selected for both alerts' : 'downloaded'}.`)}>{selected ? 'Used for both' : installed ? `Use ${character.name} for both` : `Download ${character.name}`}</button>
        <div className="wv-previews"><button aria-label={`Preview ${character.name} Needs you`} disabled={busy || !installed} onClick={() => void preview(character.id, 'needs-you')}>▷ Needs you</button><button aria-label={`Preview ${character.name} Idle`} disabled={busy || !installed} onClick={() => void preview(character.id, 'idle')}>▷ Idle</button></div>
        <div className="wv-character-footer"><a href={character.source} target="_blank" rel="noreferrer">Pack credits ↗</a>{installed && <button aria-label={`Remove ${character.name}`} disabled={busy} onClick={() => void action('remove', character.id, `${character.name} removed.`)}>Remove</button>}</div>
      </article>;
    })}</div>
    <div className="wv-card wv-quiet"><div className="wv-card-heading"><div><h3>Keep it calm</h3><p>A busy party. One voice at a time.</p></div><span className="wv-section-number" aria-hidden="true">II</span></div>
      <div className="wv-row"><span><strong>Space out idle alerts</strong><small>Across all agents. No queue of overlapping voices.</small></span><div className="wv-segments" role="group" aria-label="Idle alert spacing">{[15, 30, 60].map(seconds => <button key={seconds} aria-pressed={p.idleSpacingSeconds === seconds} disabled={busy} onClick={() => void configure({ idleSpacingSeconds: seconds })}>{seconds}s</button>)}</div></div>
      <label className="wv-row"><span><strong>Volume · {volume ?? p.volume}%</strong></span><input type="range" aria-label="Sound volume" min="0" max="100" value={volume ?? p.volume} disabled={busy} onChange={event => setVolume(Number(event.target.value))} onPointerUp={event => void saveVolume(Number(event.currentTarget.value))} onKeyUp={event => void saveVolume(Number(event.currentTarget.value))} onBlur={event => void saveVolume(Number(event.currentTarget.value))}/></label>
      <div className="wv-row"><span><strong>{paused ? 'Taking a break' : 'Need a quiet stretch?'}</strong><small>{paused ? 'New alerts resume automatically. Previews still work.' : 'Pause automatic alerts for 30 minutes.'}</small></span><button disabled={busy} onClick={() => void action('pause', !paused, paused ? 'Automatic alerts resumed.' : 'Automatic alerts paused for 30 minutes.')}>{paused ? 'Resume now' : 'Pause 30 minutes'}</button></div>
    </div>
    <p className="wv-message" role="status">{busy ? 'Working…' : message}</p>
    <footer><span>{status}</span><p>Audio downloads come from <a href="https://github.com/PeonPing/og-packs" target="_blank" rel="noreferrer">PeonPing’s original packs</a>. Pack manifests declare CC BY-NC 4.0; Warcraft audio belongs to its publisher. No game audio is bundled with this plugin.</p><p>Choose your active sound provider in Settings → Notifications. Only the selected provider plays automatic alerts.</p></footer>
  </div></section>;
}
export default definePluginApp(app => {
  const component = () => <WarcraftVoices embedded />;
  // Retain existing bookmarks without adding navigation clutter.
  app.slots.navPanel({ id: 'main', title: 'Warcraft Voices', icon: 'Swords', placement: 'unlisted', component });
  if (typeof app.slots.notificationSoundProvider === 'function') {
    app.slots.notificationSoundProvider({ id: 'notifications', title: 'Warcraft Voices', description: 'Warcraft character voices with quiet spacing and rotating clips.', component, mount: mountBackground });
  } else {
    // Older hosts can still configure and preview; automatic audio stays off.
    app.slots.settingsSection({ id: 'sounds', title: 'Warcraft Voices', description: 'Update Zana to select this provider in Settings → Notifications.', component });
  }
});
