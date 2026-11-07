import { createHash } from 'node:crypto';
import { MAX_CLIP_BYTES, MAX_PACK_BYTES, type Asset, type Character, type Clip, type VoicePack } from './model.js';
export async function readAsset(character: Character, asset: Asset, signal: AbortSignal, request: typeof fetch = fetch): Promise<Clip> {
  if (!/^[a-z0-9_]+$/.test(character.id) || !/^[a-f0-9]{40}$/.test(character.revision) || !/^sounds\/[A-Za-z0-9_.-]+$/.test(asset.file) || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error('Invalid character source.');
  const url = `https://raw.githubusercontent.com/PeonPing/og-packs/${character.revision}/${character.id}/${asset.file}`;
  const response = await request(url, { redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) });
  if (!response.ok || !response.body) throw new Error('Could not download this voice. Try again.');
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength; if (size > MAX_CLIP_BYTES) throw new Error('Voice file exceeds 1 MiB.');
      chunks.push(part.value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const bytes = Buffer.concat(chunks);
  if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error('Voice checksum did not match. Nothing was installed.');
  const mime = bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WAVE' ? 'audio/wav'
    : bytes.subarray(0,4).toString() === 'OggS' ? 'audio/ogg'
    : bytes.subarray(0,3).toString() === 'ID3' || bytes.length >= 2 && bytes[0] === 255 && (bytes[1]! & 224) === 224 ? 'audio/mpeg' : null;
  if (!mime) throw new Error('The downloaded file is not supported audio.');
  return { name: asset.label, mime, base64: bytes.toString('base64') };
}
export async function downloadCharacter(character: Character, signal: AbortSignal): Promise<VoicePack> {
  const cache = new Map<string, Clip>(); let size = 0;
  const category = async (assets: Asset[]) => {
    const clips: Clip[] = [];
    for (const asset of assets.slice(0,3)) {
      const key = `${asset.file}:${asset.sha256}`;
      let clip = cache.get(key);
      if (!clip) { clip = await readAsset(character, asset, signal); cache.set(key, clip); }
      size += Buffer.byteLength(clip.base64, 'base64');
      if (size > MAX_PACK_BYTES) throw new Error('Character audio exceeds 2 MiB.');
      clips.push(clip);
    }
    return clips;
  };
  return { id: character.id, needsYou: await category(character.needsYou), idle: await category(character.idle) };
}
