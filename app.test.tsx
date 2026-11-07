// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { installTestPluginRuntime } from '@zana-ai/zcc-plugin-sdk/testing/app';
import { DEFAULTS, type SoundState } from './model.js';
const h = vi.hoisted(() => ({ play: vi.fn(),stop: vi.fn() }));
vi.mock('./player.js', () => ({ SoundPlayer: class { play=h.play;stop=h.stop; } }));
import definition, { WarcraftVoices } from './app.tsx';
const clip = { name:'voice.wav',mime:'audio/wav' as const,base64:'UklGRg==' };
let state: SoundState, calls: Record<string,ReturnType<typeof vi.fn<(input?: any) => any>>>, runtime: ReturnType<typeof installTestPluginRuntime>;
beforeEach(() => {
  state={ preferences:{...DEFAULTS},installed:[] }; h.play.mockReset().mockResolvedValue(undefined);h.stop.mockReset();
  calls={read:vi.fn(()=>state),configure:vi.fn(p=>state={...state,preferences:{...state.preferences,...p}}),install:vi.fn(id=>state={...state,installed:[...state.installed,id],pack:{id,needsYou:[clip],idle:[clip]},preferences:{...state.preferences,packId:id}}),remove:vi.fn(id=>state={...state,installed:state.installed.filter(v=>v!==id),pack:undefined,preferences:{...state.preferences,enabled:false}}),pause:vi.fn(paused=>state={...state,preferences:{...state.preferences,pausedUntil:paused?Date.now()+1800000:0}}),preview:vi.fn(({id})=>({id,needsYou:[clip],idle:[clip]}))};
  runtime=installTestPluginRuntime({rpc:calls});
});
afterEach(cleanup);
async function loaded() {render(<WarcraftVoices/>);await screen.findByRole('switch');}
async function install() {fireEvent.click(screen.getByRole('button',{name:'Download Orc Peon'}));await screen.findByText('Orc Peon selected.');}
it('registers a Plugins page and a separate background activity listener',()=>{
  const navPanel=vi.fn(),register=vi.fn();(definition as { setup: (app: unknown) => void }).setup({slots:{navPanel},contentScripts:{register}} as never);
  expect(navPanel).toHaveBeenCalledWith(expect.objectContaining({title:'Warcraft Voices',placement:'extensions'})); expect(register).toHaveBeenCalledWith(expect.objectContaining({id:'notifications'}));
});
it('starts off, downloads on request, previews with audio off, switches and removes characters',async()=>{
  await loaded();expect(screen.getByRole('switch')).toHaveProperty('disabled',true);expect(calls.install).not.toHaveBeenCalled();
  await install();expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  fireEvent.click(screen.getByRole('button',{name:'Preview Orc Peon Needs you'}));await screen.findByText('Orc Peon · Needs you preview played.');expect(h.play).toHaveBeenCalledWith('needs-you',25,clip);
  fireEvent.click(screen.getByRole('button',{name:'Download Human Peasant'}));await screen.findByText('Human Peasant selected.');
  fireEvent.click(screen.getByRole('button',{name:'Use Orc Peon'}));await screen.findByText('Orc Peon selected.');expect(calls.configure).toHaveBeenCalledWith({packId:'peon'});
  fireEvent.click(screen.getByRole('button',{name:'Remove Orc Peon'}));await screen.findByText('Orc Peon removed.');expect(calls.remove).toHaveBeenCalledWith('peon');
});
it('saves volume with pointer, keyboard and blur, event settings, spacing and pause/resume',async()=>{
  await loaded();await install();fireEvent.click(screen.getByRole('switch'));await waitFor(()=>expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true'));
  fireEvent.click(screen.getByRole('checkbox',{name:/Becomes idle/}));await waitFor(()=>expect(calls.configure).toHaveBeenCalledWith({idle:true}));
  await waitFor(()=>expect(screen.getByRole('checkbox',{name:/Needs you/})).toHaveProperty('disabled',false));fireEvent.click(screen.getByRole('checkbox',{name:/Needs you/}));await waitFor(()=>expect(calls.configure).toHaveBeenCalledWith({needsYou:false}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'60s'})).toHaveProperty('disabled',false));fireEvent.click(screen.getByRole('button',{name:'60s'}));await waitFor(()=>expect(calls.configure).toHaveBeenCalledWith({idleSpacingSeconds:60}));
  const slider=screen.getByRole('slider');
  for(const [event,value] of [['pointerUp','0'],['keyUp','40'],['blur','50']] as const){await waitFor(()=>expect(slider).toHaveProperty('disabled',false));fireEvent.change(slider,{target:{value}});fireEvent[event](slider);await waitFor(()=>expect(calls.configure).toHaveBeenCalledWith({volume:Number(value)}));}
  await waitFor(()=>expect(screen.getByRole('button',{name:'Pause 30 minutes'})).toHaveProperty('disabled',false));fireEvent.click(screen.getByRole('button',{name:'Pause 30 minutes'}));await screen.findByRole('button',{name:'Resume now'});
  fireEvent.click(screen.getByRole('button',{name:'Resume now'}));await screen.findByRole('button',{name:'Pause 30 minutes'});
});
it('shows download, save, load and playback failures and handles realtime refresh',async()=>{
  calls.read!.mockRejectedValueOnce(new Error('offline'));await loaded().catch(()=>undefined);await screen.findByText(/offline/);cleanup();
  await loaded();calls.install!.mockRejectedValueOnce(new Error('network failed'));fireEvent.click(screen.getByRole('button',{name:'Download Orc Peon'}));await screen.findByText('network failed');await install();
  calls.configure!.mockRejectedValueOnce(new Error('disk full'));fireEvent.click(screen.getByRole('switch'));await screen.findByText('disk full');expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
  h.play.mockRejectedValueOnce(new Error('bad audio'));fireEvent.click(screen.getByRole('button',{name:'Preview Orc Peon Idle'}));await screen.findByText('bad audio');
  state={...state,preferences:{...state.preferences,volume:0}};await act(async()=>runtime.emitRealtime('changed'));
  fireEvent.click(screen.getByRole('button',{name:'Preview Orc Peon Idle'}));await screen.findByText('Volume is muted.');
  calls.preview!.mockResolvedValueOnce({id:'peon',needsYou:[],idle:[]});fireEvent.click(screen.getByRole('button',{name:'Preview Orc Peon Idle'}));await screen.findByText('This character has no sound for that alert.');
});
it('stops a preview and releases its timer on unmount',async()=>{
  await loaded();await install();fireEvent.click(screen.getByRole('button',{name:'Preview Orc Peon Idle'}));await screen.findByText('Orc Peon · Idle preview played.');const before=h.stop.mock.calls.length;cleanup();expect(h.stop.mock.calls.length).toBe(before+1);
});
