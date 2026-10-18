// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { PlayerDbSchema, type PlayerDb } from '@fantasy-dash/core';
import { aggregate } from './aggregate';
import { COLUMNS, TABS, columnValue, columnsFor, tabPositions } from './columns';

const dir = new URL('../../../../../data/playerdb/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const load = (file: string) => PlayerDbSchema.parse(JSON.parse(readFileSync(new URL(file, dir), 'utf8'))) as PlayerDb;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

describe('committed player databases', () => {
  it.each(files)('%s validates and aggregates for every tab without NaN', (file) => {
    const db = load(file);
    // A season with no scored weeks has nothing to check; the sync does not write one, so this only guards a stray file.
    if (db.throughWeek < 1) return;
    expect(db.rows.length).toBeGreaterThan(300 * Math.min(db.throughWeek, 3));
    const aggs = aggregate(db, 1, db.throughWeek);
    for (const tab of TABS) {
      const rows = aggs.filter((a) => tabPositions(tab).includes(db.players[a.id].pos));
      expect(rows.length, `${file} ${tab}`).toBeGreaterThan(20);
      for (const c of columnsFor(tab)) for (const a of rows) {
        const v = columnValue(c, a, 'total');
        expect(v === null || Number.isFinite(v), `${file} ${tab} ${c.key} ${a.id}`).toBe(true);
      }
    }
  });

  it.each(files)('%s never has snaps above team snaps, and snap share stays within 100%%', (file) => {
    const db = load(file);
    const raw = new Map<string, { snaps: number; team: number }>();
    for (const r of db.rows) {
      if (r.snaps === undefined) continue;
      expect(r.teamSnaps, `${file} ${r.id} wk${r.week} lacks teamSnaps`).toBeDefined();
      expect(r.snaps, `${file} ${r.id} wk${r.week}`).toBeLessThanOrEqual(r.teamSnaps!);
      const t = raw.get(r.id) ?? { snaps: 0, team: 0 };
      t.snaps += r.snaps; t.team += r.teamSnaps!;
      raw.set(r.id, t);
    }
    for (const [id, t] of raw) expect(t.snaps / t.team, `${file} ${id} raw season snap share`).toBeLessThanOrEqual(1.02);
    if (db.throughWeek < 1) return;
    for (const a of aggregate(db, 1, db.throughWeek)) {
      const v = columnValue(COLUMNS.snapPct, a, 'total');
      expect(v === null || v <= 1, `${file} ${a.id} snapPct ${v}`).toBe(true);
    }
  });

  it.each(files)('%s has team snaps that match a full game: the busiest player, nearly always the QB, plays every snap unless benched or hurt', (file) => {
    const db = load(file);
    const top = new Map<string, { snaps: number; team: number }>();
    for (const r of db.rows) {
      if (r.snaps === undefined || r.teamSnaps === undefined) continue;
      const k = `${r.team}|${r.week}`;
      if ((top.get(k)?.snaps ?? -1) < r.snaps) top.set(k, { snaps: r.snaps, team: r.teamSnaps });
    }
    if (top.size === 0) return;
    const full = [...top.values()].filter((t) => t.snaps === t.team).length;
    expect(full / top.size, `${file} team-weeks whose busiest player played every snap`).toBeGreaterThan(0.7);
  });

  it.each(files)('%s has intended air yards: WR aDOT and RACR medians are plausible', (file) => {
    const db = load(file);
    if (db.throughWeek < 3) return; // too few weeks for stable medians
    const tot = new Map<string, { tgt: number; air: number; yds: number }>();
    for (const r of db.rows) {
      if (db.players[r.id]?.pos !== 'WR') continue;
      const t = tot.get(r.id) ?? { tgt: 0, air: 0, yds: 0 };
      t.tgt += r.re_tgt ?? 0; t.air += r.re_air ?? 0; t.yds += r.re_yds ?? 0;
      tot.set(r.id, t);
    }
    const qualified = [...tot.values()].filter((t) => t.tgt >= 30 && t.air > 0);
    expect(qualified.length, file).toBeGreaterThan(20);
    const adot = median(qualified.map((t) => t.air / t.tgt));
    const racr = median(qualified.map((t) => t.yds / t.air));
    expect(adot, `${file} median WR aDOT`).toBeGreaterThan(6);
    expect(adot, `${file} median WR aDOT`).toBeLessThan(13);
    expect(racr, `${file} median WR RACR`).toBeLessThan(1.2);
  });
});
