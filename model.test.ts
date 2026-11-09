import { expect, it } from 'vitest';
import { CATALOG, DEFAULTS, preferences, createClipPicker, cuePackId } from './model.js';
it('normalizes booleans, spacing, selection, pause and finite volume', () => {
  for (const value of [null, 1, { volume: NaN }, { volume: Infinity, pausedUntil: Infinity }, { packId: '../escape', pausedUntil: -1 }]) expect(preferences(value)).toEqual(DEFAULTS);
  expect(preferences({ enabled: 'true', needsYou: false, idle: 1, volume: -4, idleSpacingSeconds: 8 })).toMatchObject({ enabled: false, needsYou: false, idle: false, volume: 0, idleSpacingSeconds: 30 });
  expect(preferences({ enabled: true, idle: true, volume: 1000, packId: 'murloc', pausedUntil: 123, idleSpacingSeconds: 60 })).toMatchObject({ enabled: true, idle: true, volume: 100, packId: 'murloc', pausedUntil: 123, idleSpacingSeconds: 60 });
  expect(CATALOG).toHaveLength(4);
});
it('migrates the former single character and preserves independent event assignments', () => {
  const legacy = preferences({ packId: 'peasant', enabled: true, idle: true });
  expect(legacy).toMatchObject({ needsYouPackId: 'peasant', idlePackId: 'peasant', enabled: true, idle: true });
  const mixed = preferences({ ...legacy, needsYouPackId: 'peon', idlePackId: 'murloc' });
  expect(cuePackId(mixed, 'needs-you')).toBe('peon');
  expect(cuePackId(mixed, 'idle')).toBe('murloc');
  expect(preferences({ packId: 'wc3_grunt', needsYouPackId: '../escape', idlePackId: null })).toMatchObject({ needsYouPackId: 'wc3_grunt', idlePackId: 'wc3_grunt' });
});
it('rotates independent categories and characters without adjacent repeats', () => {
  const pick = createClipPicker(() => 0), a = { name: 'a', mime: 'audio/wav' as const, base64: '' }, b = { ...a, name: 'b' }, c = { ...a, name: 'c' };
  const pack = { id: 'peon', needsYou: [a,b,c], idle: [a,b] };
  expect([pick(pack,'needs-you'),pick(pack,'needs-you'),pick(pack,'needs-you'),pick(pack,'needs-you')]).toEqual([a,b,c,a]);
  expect(pick(pack,'idle')).toBe(a); expect(pick({ ...pack, id: 'peasant' },'needs-you')).toBe(a);
  expect(pick({ id: 'none', idle: [], needsYou: [] },'idle')).toBeUndefined();
  expect(pick({ id: 'one', idle: [a], needsYou: [] },'idle')).toBe(a); expect(pick({ id: 'one', idle: [a], needsYou: [] },'idle')).toBe(a);
  expect(createClipPicker(() => 1)(pack,'needs-you')).toBe(c);
});
