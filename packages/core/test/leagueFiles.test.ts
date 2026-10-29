import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { idsFromSeasonFiles, moveKeep } from '../../../scripts/lib/leagueFiles';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = () => mkdtempSync(path.join(os.tmpdir(), 'lf-'));

describe('moveKeep', () => {
  it('replaces the league folder but carries its points over', async () => {
    const root = tmp();
    const dest = path.join(root, 'husky'), staging = path.join(root, 'staging');
    mkdirSync(path.join(dest, 'points'), { recursive: true }); writeFileSync(path.join(dest, 'points', '2025.json'), 'P');
    writeFileSync(path.join(dest, 'history.json'), 'old');
    mkdirSync(staging); writeFileSync(path.join(staging, 'history.json'), 'new');
    await moveKeep(staging, dest, ['points']);
    expect(readFileSync(path.join(dest, 'history.json'), 'utf8')).toBe('new');
    expect(readFileSync(path.join(dest, 'points', '2025.json'), 'utf8')).toBe('P');
    expect(existsSync(staging)).toBe(false);
    expect(existsSync(`${dest}.old`)).toBe(false);
  });
  it('works for a brand-new league with no folder yet', async () => {
    const root = tmp();
    const staging = path.join(root, 's'); mkdirSync(staging); writeFileSync(path.join(staging, 'history.json'), 'h');
    await moveKeep(staging, path.join(root, 'new'), ['points']);
    expect(existsSync(path.join(root, 'new', 'history.json'))).toBe(true);
  });
});

describe('idsFromSeasonFiles', () => {
  it('is empty without files', () => { expect(idsFromSeasonFiles(path.join(tmp(), 'missing')).size).toBe(0); });
  it('reads player ids from existing season files', () => {
    const dir = tmp();
    const src = path.resolve(here, '../../../data/leagues/husky/seasons');
    const year = readFileSync(path.join(src, '2025.json'), 'utf8');
    writeFileSync(path.join(dir, '2025.json'), year);
    expect(idsFromSeasonFiles(dir).size).toBeGreaterThan(50);
  });
});
