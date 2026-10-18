import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../../src/playerdb/csv';
import { nflverseTeamAirYards, nflverseWeekly } from '../../src/playerdb/sources/nflverse';
import { NGS_RECEIVING_FIELDS, ngsWeekly } from '../../src/playerdb/sources/ngs';
import { PFR_REC_FIELDS, SNAP_FIELDS, pfrWeekly, snapCountTeamSnaps } from '../../src/playerdb/sources/pfr';
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
    expect(wk1.re_air).toBe(84); // intended air yards (receiving_air_yards)
    expect(wk1.pa_air).toBe(0);
    expect(wk1).not.toHaveProperty('pa_epa'); // blank for a receiver
    expect(m.has(`${EGBUKA}|2`)).toBe(true);
  });
});

describe('nflverseTeamAirYards', () => {
  it('sums passing air yards per Sleeper team code and regular-season week', () => {
    const rows = fixture('stats_player_week.csv');
    const m = nflverseTeamAirYards([
      ...rows,
      { player_id: 'q-la', team: 'LA', week: '1', season_type: 'REG', passing_air_yards: '210' },
      { player_id: 'q2-la', team: 'LA', week: '1', season_type: 'REG', passing_air_yards: '15' },
      { player_id: 'q-la', team: 'LA', week: '19', season_type: 'POST', passing_air_yards: '300' },
      { player_id: 'q-la', team: 'LA', week: '2', season_type: 'REG', passing_air_yards: 'NA' },
    ]);
    expect(m.get('TB|1')).toBe(0);
    expect(m.get('SF|1')).toBe(0);
    expect(m.get('LAR|1')).toBe(225);
    expect(m.has('LA|1')).toBe(false);
    expect(m.has('LAR|19')).toBe(false);
    expect(m.get('LAR|2') ?? 0).toBe(0);
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

describe('snapCountTeamSnaps', () => {
  const row = (team: string, week: string, snaps: string, pct: string, type = 'REG') => ({ game_type: type, team, week, offense_snaps: snaps, offense_pct: pct });
  it('derives team snaps from the fixture, keyed by team and week', () => {
    const m = snapCountTeamSnaps(fixture('snap_counts.csv'));
    expect(m.get('TB|1')).toBe(57);
    expect(m.get('TB|2')).toBe(65);
    expect([...m.keys()].some((k) => k.endsWith('|19'))).toBe(false);
  });
  it('normalises team codes, reads the busiest player, and ignores zero percentages, zero snaps, other weeks and the postseason', () => {
    const m = snapCountTeamSnaps([
      row('LA', '3', '66', '1.00'), row('LA', '3', '40', '0.60'), row('LA', '3', '10', '0'), row('SF', '3', '0', '0.5'),
      row('SF', '19', '60', '1'), row('SF', '0', '60', '1'), row('SF', '4', '60', '1', 'POST'),
    ]);
    expect(m.get('LAR|3')).toBe(66);
    expect([...m.keys()]).toEqual(['LAR|3']);
  });
  it('ignores the rounding of a bit player, whose 1 snap at 1% would read as 100', () => {
    const m = snapCountTeamSnaps([row('ATL', '1', '1', '0.01'), row('ATL', '1', '76', '1.00'), row('ATL', '1', '3', '0.04')]);
    expect(m.get('ATL|1')).toBe(76);
  });
});

describe('nflPlayerMeta', () => {
  it('reads birth date, draft slot, college and measurements', () => {
    const m = nflPlayerMeta(fixture('players.csv'));
    expect(m.get(EGBUKA)).toEqual({ birthDate: '2002-10-14', draft: { year: 2025, round: 1, pick: 19 }, college: 'Ohio State', height: 73, weight: 205 });
  });
});
