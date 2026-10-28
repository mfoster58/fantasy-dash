import type { PlayerDb, Schedule } from '@fantasy-dash/core';
import { defenseRanks } from '../matchups/difficulty';
import { miniDb, player, row, teamWeek } from '../../test/playerDbFixtures';
import { nextFive, playerSummary } from './summary';

/** one RB with the given weekly points (null = did not play), weeks from 1 */
function dbWith(pts: (number | null)[], throughWeek = pts.length): PlayerDb {
  return {
    year: 2026, throughWeek, routesReal: false, builtAt: '',
    players: { x: player('x', 'RB', ['ATL']) },
    teamWeeks: pts.map((_, i) => teamWeek('ATL', i + 1)),
    xfp: { QB: null, RB: null, WR: null, TE: null },
    rows: pts.map((p, i) => row('x', i + 1, 'ATL', p === null ? { gp: 0, opp: `O${i + 1}` } : { pts: p, opp: `O${i + 1}` })),
  };
}
const sched = (games: [number, string, string][]): Schedule => ({ year: 2026, games: games.map(([week, home, away]) => ({ week, home, away })) });

describe('playerSummary', () => {
  it('floor and ceiling are his worst and best games played', () => {
    const s = playerSummary(dbWith([3, 8, 12, 20, 31]), 'x', null);
    expect(s).toMatchObject({ games: 5, total: 74, floor: 3, ceil: 31 });
    expect(s.avg).toBeCloseTo(14.8, 5);
  });
  it('min and max under 5 games', () => {
    expect(playerSummary(dbWith([3, 8, 12, 20]), 'x', null)).toMatchObject({ floor: 3, ceil: 20 });
  });
  it('only games played count', () => {
    expect(playerSummary(dbWith([10, null, 20]), 'x', null)).toMatchObject({ games: 2, total: 30, avg: 15 });
  });
  it('bins: 5-point, 45+ last, negatives first', () => {
    const s = playerSummary(dbWith([-2, 4.9, 5, 44.9, 45, 60]), 'x', null);
    expect(s.bins).toHaveLength(10);
    expect(s.bins).toEqual([2, 1, 0, 0, 0, 0, 0, 0, 1, 2]);
  });
  it('cv is the standard deviation over the average', () => {
    expect(playerSummary(dbWith([10, 20, 30]), 'x', null).cv).toBeCloseTo(Math.sqrt(200 / 3) / 20, 5);
  });
  it('cv needs three games and a positive average, so one game is never the steadiest', () => {
    expect(playerSummary(dbWith([12]), 'x', null).cv).toBeNull();
    expect(playerSummary(dbWith([10, 20]), 'x', null).cv).toBeNull();
    expect(playerSummary(dbWith([-2, -1, 0]), 'x', null).cv).toBeNull();
  });
  it('no games: zeros and nulls, no NaN', () => {
    const s = playerSummary(dbWith([null, null]), 'x', null);
    expect(s).toMatchObject({ games: 0, total: 0, avg: null, floor: null, ceil: null, cv: null, last5: [] });
    expect(s.bins.every((b) => b === 0)).toBe(true);
  });
  it('last5 is newest first, with home or away from the schedule', () => {
    const s = playerSummary(dbWith([1, 2, 3, 4, 5, 6]), 'x', sched([[6, 'O6', 'ATL'], [5, 'ATL', 'O5']]));
    expect(s.last5.map((g) => g.week)).toEqual([6, 5, 4, 3, 2]);
    expect(s.last5[0]).toEqual({ week: 6, opp: 'O6', home: false, pts: 6 });
    expect(s.last5[1].home).toBe(true);
    expect(s.last5[2].home).toBeNull();
  });
  it("team is his latest row's team after a trade", () => {
    expect(playerSummary(miniDb(), 'w1', null).team).toBe('KC');
  });
});

describe('nextFive', () => {
  const db = dbWith([10, 12, 14], 3);
  it('the five weeks after throughWeek, with a bye', () => {
    const s = sched([[4, 'ATL', 'NO'], [5, 'TB', 'ATL'], [7, 'ATL', 'CAR'], [8, 'GB', 'ATL'], [3, 'ATL', 'SF']]);
    const n = nextFive(db, s, 'ATL', 'RB')!;
    expect(n.map((g) => [g.week, g.opp, g.home])).toEqual([[4, 'NO', true], [5, 'TB', false], [6, null, false], [7, 'CAR', true], [8, 'GB', false]]);
  });
  it('stops at week 18', () => {
    const late = dbWith(Array(16).fill(10), 16);
    const s = sched([[17, 'ATL', 'NO'], [18, 'TB', 'ATL']]);
    expect(nextFive(late, s, 'ATL', 'RB')!.map((g) => g.week)).toEqual([17, 18]);
  });
  it('null when no week is left or there is no schedule', () => {
    expect(nextFive(dbWith(Array(18).fill(10), 18), sched([[18, 'ATL', 'NO']]), 'ATL', 'RB')).toBeNull();
    expect(nextFive(db, null, 'ATL', 'RB')).toBeNull();
  });
  it('tone and rank come from the defence ranks', () => {
    const m = miniDb();
    const ranks = defenseRanks(m);
    const n = nextFive(m, sched([[4, 'TB', 'OPP']]), 'TB', 'WR')!;
    const want = ranks('OPP', 'WR');
    expect(n[0]).toMatchObject({ opp: 'OPP', tone: want?.tone ?? null, rank: want?.rank ?? null, of: want?.of ?? null });
  });
});
