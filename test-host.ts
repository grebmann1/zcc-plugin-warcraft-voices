import { DatabaseSync } from 'node:sqlite';
import { createFakePluginHost } from '@zana-ai/zcc-plugin-sdk/testing';
import type { PluginDatabase } from '@zana-ai/zcc-plugin-sdk/server';
export function wired() {
  const raw = new DatabaseSync(':memory:');
  const database: PluginDatabase = { runScript: sql => raw.exec(sql), prepare: sql => raw.prepare(sql) as unknown as ReturnType<PluginDatabase['prepare']>,
    migrate: statements => { for (const sql of statements) raw.exec(sql); }, transaction: fn => { raw.exec('BEGIN'); try { const value = fn(); raw.exec('COMMIT'); return value; } catch(error) { raw.exec('ROLLBACK'); throw error; } } };
  const options = { pluginId: 'warcraft-voices', database };
  return { ...createFakePluginHost(options), close: () => raw.close() };
}
export const clip = { name: 'voice.wav', mime: 'audio/wav' as const, base64: Buffer.from('RIFFxxxxWAVEdata').toString('base64') };
