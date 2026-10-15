import { describe, it, expect } from 'vitest';
import { game, line, players, season, side, week } from '../test/playerFixtures';
import { filterLines, flattenLines, isPosFilter, POS_FILTERS } from './playerLines';

describe('flattenLines', () => {
  const s = season(2025, [
    week(1, [game(2025, 1, 1,
      side('a', 50, [line('q1', 30, { pass_yd: 300, pass_td: 2, rush_yd: 10 }), line('ghost', 0, {})], [line('r1', 20, { rush_yd: 80, rec: 4, rec_yd: 40, rec_td: 1 })]),
      side('b', 10, [line('KC', 10, { sack: 3, def_td: 1 })]))]),
    week(3, [game(2025, 3, 1, side('a', 20, [line('q1', 20, { pass_yd: 200 })]), side('b', 5, [line('k1', 5, { fgm: 1 })]), 'Final')], true),
    week(4, [game(2025, 4, 1, side('a', 1, [line('t1', 1, { rec: 1 })]), side('b', 0, [line('w1', 0, { rec_tgt: 1 })]), 'Toilet Bowl')], true),
  ]);
  const lines = flattenLines([s], players);

  it('emits one line per started or benched player with derived stats', () => {
    const q1 = lines.find((l) => l.playerId === 'q1' && l.week === 1)!;
    expect(q1).toEqual({
      playerId: 'q1', userId: 'a', year: 2025, week: 1, gameId: '2025-1-1', matchupId: 1, tag: null, started: true,
      points: 30, yards: 310, touchdowns: 2, receptions: 0, played: true, postseason: false, consolation: false, position: 'QB',
      targets: 0, carries: 0, passAttempts: 0, rushYards: 10, recYards: 0, passYards: 300, rushTd: 0, recTd: 0, passTd: 2,
    });
    const r1 = lines.find((l) => l.playerId === 'r1')!;
    expect(r1).toMatchObject({ started: false, yards: 120, touchdowns: 1, receptions: 4, played: true });
  });

  it('marks unplayed weeks and unknown players', () => {
    const ghost = lines.find((l) => l.playerId === 'ghost')!;
    expect(ghost).toMatchObject({ played: false, points: 0, position: '?' });
  });

  it('does not count defensive touchdowns as touchdowns', () => {
    expect(lines.find((l) => l.playerId === 'KC')!.touchdowns).toBe(0);
  });

  it('carries raw opportunity and split fields, zero when absent', () => {
    const q1 = lines.find((l) => l.playerId === 'q1' && l.week === 1)!;
    expect(q1).toMatchObject({ targets: 0, carries: 0, passAttempts: 0, rushYards: 10, recYards: 0, passYards: 300, rushTd: 0, recTd: 0, passTd: 2 });
    const rich = flattenLines([season(2025, [week(1, [game(2025, 1, 1,
      side('a', 30, [line('r1', 30, { rec_tgt: 7, rec: 5, rush_att: 12, rush_yd: 70, rec_yd: 40, rush_td: 1, rec_td: 1, pass_att: 1 })]),
      side('b', 0, [line('t1', 0, {})]))])])], players);
    expect(rich.find((l) => l.playerId === 'r1')).toMatchObject({ targets: 7, carries: 12, passAttempts: 1, rushYards: 70, recYards: 40, passYards: 0, rushTd: 1, recTd: 1, passTd: 0, yards: 110, touchdowns: 2 });
  });

  it('flags consolation games and not championship-bracket ones', () => {
    expect(lines.find((l) => l.week === 4 && l.playerId === 't1')!.consolation).toBe(true);   // Toilet Bowl
    expect(lines.find((l) => l.week === 3 && l.playerId === 'q1')!.consolation).toBe(false);  // Final
    const cons = flattenLines([season(2025, [
      week(3, [game(2025, 3, 1, side('a', 1, [line('q1', 1)]), side('b', 0, [line('r1', 0)]), 'Cons-R1')], true),
      week(4, [game(2025, 4, 1, side('a', 1, [line('w1', 1)]), side('b', 0, [line('t1', 0)]), 'Cons-7th')], true),
    ])], players);
    expect(cons.every((l) => l.consolation)).toBe(true);
    expect(cons.every((l) => !l.postseason)).toBe(true);
  });

  it('flags championship-bracket games as postseason and consolation games as not', () => {
    expect(lines.find((l) => l.week === 3 && l.playerId === 'q1')!.postseason).toBe(true);
    expect(lines.find((l) => l.week === 4 && l.playerId === 't1')!.postseason).toBe(false);
  });

  it('skips weeks that have not been played', () => {
    const unplayed = season(2026, [week(1, [])]);
    expect(flattenLines([unplayed], players)).toEqual([]);
  });

  describe('filterLines', () => {
    it('keeps everything under All, including unknown positions', () => {
      expect(filterLines(lines, 'All')).toHaveLength(lines.length);
    });
    it('narrows to one position', () => {
      expect(filterLines(lines, 'QB').map((l) => l.playerId)).toEqual(['q1', 'q1']);
      expect(filterLines(lines, 'DEF').map((l) => l.playerId)).toEqual(['KC']);
    });
    it('FLEX means RB, WR or TE and drops unknown positions', () => {
      expect(new Set(filterLines(lines, 'FLEX').map((l) => l.playerId))).toEqual(new Set(['r1', 't1', 'w1']));
    });
  });

  it('exposes the filter list and a guard', () => {
    expect(POS_FILTERS).toEqual(['All', 'QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF']);
    expect(isPosFilter('RB')).toBe(true);
    expect(isPosFilter('XYZ')).toBe(false);
    expect(isPosFilter(null)).toBe(false);
  });
});
