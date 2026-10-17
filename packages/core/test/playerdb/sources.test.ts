import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../../src/playerdb/csv';
import { nflverseWeekly } from '../../src/playerdb/sources/nflverse';
import { NGS_RECEIVING_FIELDS, ngsWeekly } from '../../src/playerdb/sources/ngs';
import { PFR_REC_FIELDS, SNAP_FIELDS, pfrWeekly } from '../../src/playerdb/sources/pfr';
import { nflPlayerMeta } from '../../src/playerdb/sources/players';

const fixture = (name: string) => [...parseCsv(readFileSync(new URL(`../fixtures/playerdb/${name}`, import.meta.url), 'utf8'))];
const EGBUKA = '00-0040129';

describe('nflverseWeekly', () => {
  it('keys regular-season rows by gsis and week with the advanced fields', () => {
    const m = nflverseWeekly(fixture('stats_player_week.csv'));
    const wk1 = m.get(`${EGBUKA}|1`)!;
    expect(wk1.re_epa).toBeCloseTo(4.752, 3);
    expect(wk1.re_tgtShare).toBeCloseTo(0.222, 3);
    expect(wk1.re_wopr).toBeCloseTo(0.745, 3);
    expect(wk1.re_yac).toBe(20);
    expect(wk1.re_fd).toBe(3);
    expect(wk1).not.toHaveProperty('pa_epa'); // blank for a receiver
    expect(m.has(`${EGBUKA}|2`)).toBe(true);
  });
});

describe('ngsWeekly', () => {
  it('keeps only the asked season, drops the week-0 season total', () => {
    const m = ngsWeekly(fixture('ngs_receiving.csv'), 2026, NGS_RECEIVING_FIELDS);
    expect(m.has(`${EGBUKA}|0`)).toBe(false);
    const wk1 = m.get(`${EGBUKA}|1`)!;
    expect(wk1.re_sep).toBeCloseTo(2.405, 3);
    expect(wk1.re_cush).toBeCloseTo(7.44, 2);
    expect(wk1.re_yacoe).toBeCloseTo(1.176, 3);
    expect([...m.keys()].every((k) => k.startsWith(EGBUKA))).toBe(true);
    expect(ngsWeekly(fixture('ngs_receiving.csv'), 2025, NGS_RECEIVING_FIELDS).size).toBe(1);
  });
});

describe('pfrWeekly', () => {
  it('keys by pfr id and week, skipping the postseason', () => {
    const rec = pfrWeekly(fixture('advstats_week_rec.csv'), PFR_REC_FIELDS);
    expect(rec.get('EgbuEm01|1')).toMatchObject({ re_dropPfr: 0, re_rtg: 110.4 });
    const snaps = pfrWeekly(fixture('snap_counts.csv'), SNAP_FIELDS);
    expect(snaps.get('EgbuEm01|1')?.snaps).toBe(49);
    expect([...snaps.keys()].some((k) => k.endsWith('|19'))).toBe(false);
  });
});

describe('nflPlayerMeta', () => {
  it('reads birth date, draft slot, college and measurements', () => {
    const m = nflPlayerMeta(fixture('players.csv'));
    expect(m.get(EGBUKA)).toEqual({ birthDate: '2002-10-14', draft: { year: 2025, round: 1, pick: 19 }, college: 'Ohio State', height: 73, weight: 205 });
  });
});
