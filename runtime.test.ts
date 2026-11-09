// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PluginAgentActivitySnapshot, PluginContentScriptContext } from '@zana-ai/zcc-plugin-sdk/app';
import { DEFAULTS } from './model.js';
const h = vi.hoisted(() => ({ call: vi.fn(), play: vi.fn(), stop: vi.fn() }));
vi.mock('@zana-ai/zcc-plugin-sdk/app', () => ({ callPluginRpc: h.call }));
vi.mock('./player.js', () => ({ SoundPlayer: class { play = h.play; stop = h.stop; } }));
import { mountBackground, runtimeStatus } from './runtime.js';
const clip = { name: 'voice.wav', mime: 'audio/wav', base64: 'UklGRg==' };
const pack = { id: 'peon', needsYou: [clip], idle: [clip] };
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
let controller: AbortController, listener: (snapshot: PluginAgentActivitySnapshot) => void, signal: () => void, context: PluginContentScriptContext, lock: ReturnType<typeof vi.fn>, disposals: ReturnType<typeof vi.fn<() => void>>[];
const snapshot = (state: 'working' | 'idle' | 'needs-you', ready = true): PluginAgentActivitySnapshot => ({ ready, agents: [{ id: 'a', kind: 'thread', state }] });
beforeEach(() => {
  vi.useFakeTimers(); h.call.mockReset().mockResolvedValue({ preferences: { ...DEFAULTS, enabled: true, idle: true }, installed: [], pack }); h.play.mockReset().mockResolvedValue(undefined); h.stop.mockReset();
  controller = new AbortController(); disposals = [vi.fn(), vi.fn()];
  context = { pluginId: 'test', generation: 1, signal: controller.signal,
    experimental_observeAgents: vi.fn(fn => { listener = fn; fn(snapshot('working')); return disposals[0]!; }),
    experimental_onSignal: vi.fn((_channel, fn) => { signal = () => fn(null); return disposals[1]!; }) };
  lock = vi.fn((_name, _options, fn) => Promise.resolve().then(fn)); Object.defineProperty(navigator, 'locks', { value: { request: lock }, configurable: true });
});
afterEach(async () => { controller.abort(); await tick(); vi.useRealTimers(); });
it('elects one owner, announces transitions and releases subscriptions/audio on abort', async () => {
  const statusChanged = vi.fn(), offStatus = runtimeStatus.subscribe(statusChanged), dispose = mountBackground(context); await tick();
  expect(lock).toHaveBeenCalledWith('test:notification-player', { signal: expect.any(AbortSignal) }, expect.any(Function)); expect(h.play).not.toHaveBeenCalled();
  listener(snapshot('idle')); vi.advanceTimersByTime(5000); expect(h.play).toHaveBeenCalledWith('idle', 25, clip);
  listener(snapshot('needs-you')); expect(h.play).toHaveBeenLastCalledWith('needs-you', 25, clip);
  dispose(); await tick(); expect(disposals[0]).toHaveBeenCalled(); expect(disposals[1]).toHaveBeenCalled(); expect(h.stop).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0); expect(statusChanged).toHaveBeenCalled(); offStatus();
});
it('waits for a ready main-shell snapshot before taking the lock', async () => {
  context = { ...context, experimental_observeAgents: fn => { listener = fn; fn({ ready: false, agents: [] }); return disposals[0]!; } };
  mountBackground(context); await tick(); expect(lock).not.toHaveBeenCalled(); listener(snapshot('working')); await tick(); expect(lock).toHaveBeenCalledTimes(1);
});
it('reloads settings, cancels idle timers, and remains silent for unmapped custom events', async () => {
  mountBackground(context); await tick(); listener(snapshot('idle'));
  h.call.mockResolvedValue({ preferences: { ...DEFAULTS, enabled: true, idle: true, packId: 'custom' }, installed: [], pack: undefined }); signal(); await tick();
  vi.advanceTimersByTime(5000); expect(h.play).not.toHaveBeenCalled(); listener(snapshot('needs-you')); expect(h.play).not.toHaveBeenCalled();
  h.call.mockRejectedValue(new Error('offline')); signal(); await tick(); expect(runtimeStatus.get()).toContain('Could not reload');
});
it('reports unsupported hosts and lock failures without guessing another playback path', async () => {
  mountBackground({ ...context, experimental_observeAgents: undefined }); expect(runtimeStatus.get()).toContain('app update');
  lock.mockRejectedValue(new Error('lock failure')); mountBackground(context); await tick(); expect(runtimeStatus.get()).toContain('lock failure');
});
it('ignores aborted loads and reports playback failures', async () => {
  h.play.mockRejectedValue(new Error('device unavailable')); mountBackground(context); await tick(); listener(snapshot('needs-you')); await tick(); expect(runtimeStatus.get()).toContain('device unavailable');
  controller.abort(); await tick(); controller = new AbortController(); context = { ...context, signal: controller.signal }; controller.abort(); mountBackground(context); await tick();
  expect(lock).toHaveBeenCalledTimes(1);
});
it('uses the newest settings response and ignores a response arriving after disposal', async () => {
  const dispose = mountBackground(context); await tick();
  let older!: (state: unknown) => void, newer!: (state: unknown) => void;
  h.call.mockImplementationOnce(() => new Promise(resolve => { older = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { newer = resolve; }));
  signal(); signal();
  const clip = { name: 'request.wav', mime: 'audio/wav', base64: 'UklGRg==' };
  newer({ preferences: { ...DEFAULTS, enabled: true, packId: 'custom', volume: 60 }, installed: ['peon'], pack: { id: 'peon', needsYou: [clip], idle: [] } }); await tick();
  older({ preferences: { ...DEFAULTS, enabled: true, volume: 10 }, installed: [], pack }); await tick();
  listener(snapshot('needs-you')); expect(h.play).toHaveBeenCalledExactlyOnceWith('needs-you', 60, clip);
  let late!: (state: unknown) => void;
  h.call.mockImplementationOnce(() => new Promise(resolve => { late = resolve; })); signal();
  dispose(); await tick(); const stopped = h.stop.mock.calls.length;
  late({ preferences: { ...DEFAULTS, enabled: true }, installed: [], pack }); await tick();
  expect(h.stop).toHaveBeenCalledTimes(stopped); expect(vi.getTimerCount()).toBe(0);
});
it('does not create a player when disposed during its initial settings read', async () => {
  let resolve!: (state: unknown) => void;
  h.call.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const dispose = mountBackground(context); await tick(); dispose();
  resolve({ preferences: DEFAULTS, installed: [], pack }); await tick();
  expect(context.experimental_onSignal).not.toHaveBeenCalled(); expect(h.play).not.toHaveBeenCalled();
});

it('uses the host master even when the retained legacy plugin preference was off', async () => {
  h.call.mockResolvedValue({ preferences: { ...DEFAULTS, enabled: false }, pack });
  mountBackground(context); await tick(); listener(snapshot('needs-you'));
  expect(h.play).toHaveBeenCalledWith('needs-you', 25, clip);
});
it('plays the assigned character for each event while the controls are closed', async () => {
  const orc = { ...clip, name: 'orc-request.wav' }, human = { ...clip, name: 'human-idle.wav' };
  h.call.mockResolvedValue({ preferences: { ...DEFAULTS, needsYouPackId: 'peon', idlePackId: 'peasant', idle: true },
    installed: ['peon', 'peasant'], pack: { id: 'peon', needsYou: [orc], idle: [human] } });
  mountBackground(context); await tick();
  listener(snapshot('idle')); vi.advanceTimersByTime(5000);
  expect(h.play).toHaveBeenLastCalledWith('idle', 25, human);
  listener(snapshot('needs-you'));
  expect(h.play).toHaveBeenLastCalledWith('needs-you', 25, orc);
  expect(h.play).toHaveBeenCalledTimes(2);
});
