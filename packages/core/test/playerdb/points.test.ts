import { describe, it, expect } from 'vitest';
import { applyLeaguePoints, buildLeaguePoints, NO_XFP, pointsUpToDate, splitLeaguePoints } from '../../src/playerdb/points';
import { LeaguePointsSchema, SharedPlayerDbSchema } from '../../src/playerdb/schema';
import type { PlayerDb, PlayerWeek, SharedPlayerDb } from '../../src/playerdb/types';
import type { SleeperWeekStat } from '../../src/sleeper/types';

const player = (id: string) => ({ id, gsisId: null, pfrId: null, name: id, pos: 'WR' as const, teams: ['TB'], birthDate: null, yearsExp: null, draft: null, college: null, height: null, weight: null });
const row = (id: string, week: number, extra: Partial<PlayerWeek> = {}): PlayerWeek => ({ id, week, team: 'TB', gp: 1, re_tgt: 5 + week, ...extra });

const db: PlayerDb = {
  year: 2025, throughWeek: 2, routesReal: true, builtAt: 'B1',
  players: { a: player('a'), b: player('b') }, teamWeeks: [],
  xfp: { QB: null, RB: null, WR: [1, 2, 0, 0, 0, 0], TE: null },
  rows: [row('a', 1, { pts: 10.5, proj: 9, xfp: 13 }), row('a', 2, { pts: 3, xfp: 15 }), row('b', 1, { pts: 7.25, proj: 8 }), row('b', 2)],
};

describe('splitLeaguePoints / applyLeaguePoints', () => {
  it('round-trips a playerdb exactly', () => {
    const { shared, points } = splitLeaguePoints(db, 'L1', 'P1');
    expect(shared.rows.every((r) => !('pts' in r) && !('proj' in r) && !('xfp' in r))).toBe(true);
    expect(shared).not.toHaveProperty('xfp');
    expect(points).toEqual({
      year: 2025, leagueId: 'L1', builtAt: 'P1', dbBuiltAt: 'B1', xfp: db.xfp,
      players: { a: [[1, 10.5, 9, 13], [2, 3, null, 15]], b: [[1, 7.25, 8, null]] },
    });
    expect(LeaguePointsSchema.parse(points)).toEqual(points);
    expect(applyLeaguePoints(SharedPlayerDbSchema.parse(shared) as SharedPlayerDb, points)).toEqual(db);
  });
  it('leaves rows without an entry unscored, and has no xFP model without a points file', () => {
    const { shared } = splitLeaguePoints(db, 'L1', 'P1');
    const joined = applyLeaguePoints(shared, null);
    expect(joined.xfp).toEqual(NO_XFP);
    expect(joined.rows.every((r) => r.pts === undefined)).toBe(true);
  });
});

describe('buildLeaguePoints', () => {
  const wk = (week: number): SleeperWeekStat[] => ['a', 'b'].map((id, i) => ({ player_id: id, team: 'TB', stats: { gp: 1, rec: 3 + i + week, rec_yd: 40 + 10 * i + week, rec_td: i } }));
  const shared: SharedPlayerDb = {
    year: 2025, throughWeek: 2, routesReal: true, builtAt: 'B1', players: { a: player('a'), b: player('b') }, teamWeeks: [],
    rows: [row('a', 1), row('a', 2), row('b', 1), row('b', 2), row('c', 1)],
  };
  const input = (scoring: Record<string, number>) => ({
    shared, leagueId: 'L1', builtAt: 'P1', scoring,
    sleeperWeeks: new Map([[1, wk(1)], [2, wk(2)]]),
    projections: new Map([[1, { a: { rec: 4, rec_yd: 50 } }]]),
  });
  it('scores each row with the league scoring and its projection', () => {
    const p = buildLeaguePoints(input({ rec: 1, rec_yd: 0.1, rec_td: 6 }));
    expect(p.players.a[0]).toEqual([1, 8.1, 9, null]);
    expect(p.players.b[1][1]).toBeCloseTo(17.2, 2); // week 2: 6 rec + 52 yds · 0.1 + 1 TD · 6
    expect(p.players.c).toBeUndefined();
    expect(p.dbBuiltAt).toBe('B1');
  });
  it('gives different points under different scoring', () => {
    const ppr = buildLeaguePoints(input({ rec: 1, rec_yd: 0.1 }));
    const std = buildLeaguePoints(input({ rec_yd: 0.1 }));
    expect(ppr.players.a[0][1]).not.toBe(std.players.a[0][1]);
  });
});

describe('pointsUpToDate', () => {
  const good = splitLeaguePoints(db, 'L1', 'P1').points;
  it('is true only for a parsing file built for this league against this exact playerdb', () => {
    expect(pointsUpToDate(good, { leagueId: 'L1', dbBuiltAt: 'B1' })).toBe(true);
    expect(pointsUpToDate(good, { leagueId: 'L2', dbBuiltAt: 'B1' })).toBe(false);
    expect(pointsUpToDate(good, { leagueId: 'L1', dbBuiltAt: 'B2' })).toBe(false);
    expect(pointsUpToDate({ nope: 1 }, { leagueId: 'L1', dbBuiltAt: 'B1' })).toBe(false);
    expect(pointsUpToDate(undefined, { leagueId: 'L1', dbBuiltAt: 'B1' })).toBe(false);
  });
});
