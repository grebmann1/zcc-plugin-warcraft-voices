import rawCatalog from './catalog.json';
export type Cue = 'needs-you' | 'idle';
export interface Clip { name: string; mime: 'audio/wav' | 'audio/mpeg' | 'audio/ogg'; base64: string }
export interface VoicePack { id: string; needsYou: Clip[]; idle: Clip[] }
export interface Asset { file: string; label: string; sha256: string }
export interface Character { id: string; name: string; sigil: string; author: string; license: string; source: string; revision: string; needsYou: Asset[]; idle: Asset[] }
export const CATALOG: readonly Character[] = rawCatalog;
export interface Preferences { enabled: boolean; needsYou: boolean; idle: boolean; volume: number; idleSpacingSeconds: number; packId: string; pausedUntil: number }
export interface SoundState { preferences: Preferences; installed: string[]; pack?: VoicePack }
export const DEFAULTS: Preferences = { enabled: false, needsYou: true, idle: false, volume: 25, idleSpacingSeconds: 30, packId: 'peon', pausedUntil: 0 };
export const MAX_CLIP_BYTES = 1024 * 1024;
export const MAX_PACK_BYTES = 2 * 1024 * 1024;
export function preferences(value: unknown): Preferences {
  const v = value && typeof value === 'object' ? value as Partial<Preferences> : {};
  return { enabled: v.enabled === true, needsYou: v.needsYou !== false, idle: v.idle === true,
    volume: typeof v.volume === 'number' && Number.isFinite(v.volume) ? Math.max(0, Math.min(100, Math.round(v.volume))) : DEFAULTS.volume,
    idleSpacingSeconds: [15, 30, 60].includes(v.idleSpacingSeconds ?? 0) ? v.idleSpacingSeconds! : 30,
    packId: CATALOG.some(c => c.id === v.packId) ? v.packId! : 'peon',
    pausedUntil: typeof v.pausedUntil === 'number' && Number.isFinite(v.pausedUntil) && v.pausedUntil > 0 ? v.pausedUntil : 0 };
}
/** Rotates each character/category independently without consecutive repeats. */
export function createClipPicker(random = Math.random) {
  const last = new Map<string, number>();
  return (pack: VoicePack, cue: Cue): Clip | undefined => {
    const clips = cue === 'idle' ? pack.idle : pack.needsYou;
    if (!clips.length) return undefined;
    const key = `${pack.id}:${cue}`, before = last.get(key);
    const span = before === undefined ? clips.length : Math.max(1, clips.length - 1);
    const offset = Math.floor(Math.max(0, Math.min(0.999999, random())) * span);
    const index = before === undefined ? offset : (before + 1 + offset) % clips.length;
    last.set(key, index); return clips[index];
  };
}
