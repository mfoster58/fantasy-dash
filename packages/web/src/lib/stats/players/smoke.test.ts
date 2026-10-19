// @vitest-environment node
import { readFileSync } from 'node:fs';
import type { ChartDb, PlayerDb } from '@fantasy-dash/core';
import { seasonStats } from './season';
import { trends } from './trends';
import { VIEWS, viewPool } from './views';

const root = new URL('../../../../../../data/', import.meta.url);
const json = <T,>(p: string) => JSON.parse(readFileSync(new URL(p, root), 'utf8')) as T;
const finite = (o: unknown) => !JSON.stringify(o, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? '__BAD__' : v)).includes('__BAD__');

describe('players stats over the committed data', () => {
  for (const year of [2025, 2026]) {
    it(`${year}: every view's pool is finite and at most 40; trends exclude the injured`, () => {
      const db = json<PlayerDb>(`playerdb/${year}.json`), ch = json<ChartDb>(`charts/${year}.json`);
      const stats = seasonStats(db, ch);
      expect(finite(stats)).toBe(true);
      for (const v of VIEWS) for (const p of v.pos) { const pool = viewPool(v, stats, p); expect(pool.length).toBeLessThanOrEqual(40); if (!v.participation || ch.participation) expect(pool.length, `${year} ${p} ${v.id}`).toBeGreaterThan(0); }
      for (const pos of ['RB', 'WR', 'TE'] as const) {
        const t = trends(db, ch, pos);
        const injured = new Set(t.injured.map((i) => i.id));
        expect([...t.up, ...t.down].some((r) => injured.has(r.id))).toBe(false);
        expect(t.up.every((r, i) => i === 0 || t.up[i - 1].score >= r.score)).toBe(true);
        expect(finite(t)).toBe(true);
      }
    });
  }
  it('2026 has play-by-play counts without participation', () => {
    const ch = json<ChartDb>('charts/2026.json');
    expect(ch.participation).toBe(false);
    expect(Object.values(ch.players).some((p) => p.plays?.rush)).toBe(true);
  });
});
