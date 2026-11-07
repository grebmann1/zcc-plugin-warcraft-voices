import { createHash } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { downloadCharacter, readAsset } from './download.js';
import { CATALOG, MAX_CLIP_BYTES, type Asset } from './model.js';
const controller = new AbortController(), character = CATALOG[0]!;
const assetFor = (bytes: Buffer): Asset => ({ file: 'sounds/test.wav', label: 'Test', sha256: createHash('sha256').update(bytes).digest('hex') });
const requestFor = (bytes: Buffer) => vi.fn(async () => new Response(new Uint8Array(bytes)));
afterEach(() => vi.unstubAllGlobals());
it.each([['RIFFxxxxWAVEdata','audio/wav'],['OggSdata','audio/ogg'],['ID3data','audio/mpeg'],[String.fromCharCode(255,251,0),'audio/mpeg']])('verifies checksums and recognizes audio signatures: %s', async (raw, mime) => {
  const bytes = Buffer.from(raw, 'latin1'), asset = assetFor(bytes), request = requestFor(bytes);
  expect(await readAsset(character,asset,controller.signal,request)).toEqual({ name: 'Test', mime, base64: bytes.toString('base64') });
  expect(request).toHaveBeenCalledWith(`https://raw.githubusercontent.com/PeonPing/og-packs/${character.revision}/peon/sounds/test.wav`, { redirect: 'error', signal: expect.any(AbortSignal) });
});
it('rejects invalid paths and revisions before any network request', async () => {
  const asset = assetFor(Buffer.from('x')), request = vi.fn();
  for (const file of ['../x','sounds/../x','https://bad.com/x','/tmp/x','sounds/a\\b','sounds/x?token=a']) await expect(readAsset(character,{ ...asset,file },controller.signal,request)).rejects.toThrow('Invalid');
  await expect(readAsset({ ...character,id:'../x' },asset,controller.signal,request)).rejects.toThrow('Invalid');
  await expect(readAsset({ ...character,revision:'main' },asset,controller.signal,request)).rejects.toThrow('Invalid');
  await expect(readAsset(character,{ ...asset,sha256:'bad' },controller.signal,request)).rejects.toThrow('Invalid'); expect(request).not.toHaveBeenCalled();
});
it('rejects HTTP errors, no body, wrong hashes, non audio, oversize and reader errors', async () => {
  const bytes = Buffer.from('RIFFxxxxWAVEdata'), asset = assetFor(bytes);
  for (const response of [new Response('missing',{status:404}),new Response(null)]) await expect(readAsset(character,asset,controller.signal,async () => response)).rejects.toThrow('Could not');
  await expect(readAsset(character,{ ...asset,sha256:'0'.repeat(64) },controller.signal,requestFor(bytes))).rejects.toThrow('checksum');
  const html = Buffer.from('<html>oops'); await expect(readAsset(character,assetFor(html),controller.signal,requestFor(html))).rejects.toThrow('not supported');
  const full = Buffer.alloc(MAX_CLIP_BYTES+1); await expect(readAsset(character,assetFor(full),controller.signal,requestFor(full))).rejects.toThrow('1 MiB');
  await expect(readAsset(character,asset,controller.signal,async () => new Response(new ReadableStream({ start(c) { c.error(new Error('stream broke')); } })))).rejects.toThrow('stream broke');
});
it('propagates cancellation and download failures', async () => {
  const stopped = new AbortController(); stopped.abort();
  const request = vi.fn(async (_url, options) => { options?.signal?.throwIfAborted(); throw new Error('network'); });
  await expect(readAsset(character,assetFor(Buffer.from('x')),stopped.signal,request)).rejects.toThrow();
  await expect(readAsset(character,assetFor(Buffer.from('x')),controller.signal,request)).rejects.toThrow('network');
});
it('deduplicates shared files and limits each category to three clips', async () => {
  const bytes = Buffer.from('RIFFxxxxWAVEdata'), asset = assetFor(bytes), request = requestFor(bytes); vi.stubGlobal('fetch',request);
  const pack = await downloadCharacter({ ...character, needsYou:Array(5).fill(asset), idle:[asset] },controller.signal);
  expect(request).toHaveBeenCalledTimes(1); expect(pack.needsYou).toHaveLength(3); expect(pack.idle).toHaveLength(1);
  const empty = await downloadCharacter({ ...character,needsYou:[],idle:[] },controller.signal); expect(empty.idle).toEqual([]);
});
it('rejects a character over the aggregate limit even with individually bounded files', async () => {
  const bytes = Buffer.alloc(MAX_CLIP_BYTES);bytes.write('RIFF');bytes.write('WAVE',8);const asset = assetFor(bytes); vi.stubGlobal('fetch',requestFor(bytes));
  await expect(downloadCharacter({ ...character,needsYou:[asset,asset],idle:[asset] },controller.signal)).rejects.toThrow('2 MiB');
});
