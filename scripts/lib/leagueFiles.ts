import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { SeasonSchema, collectPlayerIds } from '@fantasy-dash/core';

/** Swap directory `to` for `from`, carrying `keep` subfolders of the old `to` across (they belong to another sync). */
export async function moveKeep(from: string, to: string, keep: string[]): Promise<void> {
  for (const k of keep) {
    const old = path.join(to, k);
    if (existsSync(old)) { await rm(path.join(from, k), { recursive: true, force: true }); await rename(old, path.join(from, k)); }
  }
  const backup = `${to}.old`;
  await rm(backup, { recursive: true, force: true });
  if (existsSync(to)) await rename(to, backup);
  await rename(from, to);
  await rm(backup, { recursive: true, force: true });
}

/** Player ids in a league's existing season files: keeps a league that failed this sync from losing its names in players.json. */
export function idsFromSeasonFiles(dir: string): Set<string> {
  if (!existsSync(dir)) return new Set();
  const seasons = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => SeasonSchema.parse(JSON.parse(readFileSync(path.join(dir, f), 'utf8'))));
  return collectPlayerIds(seasons);
}
