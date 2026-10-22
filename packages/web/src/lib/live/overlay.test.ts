import type { Manager, PlayerLine, SleeperMatchup, Week } from '@fantasy-dash/core';
import { game, season, side, week } from '../../test/playerFixtures';
import { liveWeek, liveWeekNumber, tickerWeek } from './overlay';

const managers: Record<string, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: null, avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: null, avatar: null, rosterId: 2 },
};
const L = (playerId: string, projected: number | null, stats: Record<string, number> = {}): PlayerLine => ({ playerId, points: 0, projected, stats });

/** an unplayed synced week: a starts q1 at QB and r1 at RB, benches w1; b starts t1 and k1 */
function synced(): Week {
  const a = side('a', 0, [L('q1', 20, { pass_yd: 1 }), L('r1', 15)], [L('w1', 12)]);
  a.starters = [{ slot: 'QB', player: L('q1', 20, { pass_yd: 1 }) }, { slot: 'RB', player: L('r1', 15) }];
  a.projected = 35;
  const b = side('b', 0, [L('t1', 9), L('k1', 8)]);
  b.starters = [{ slot: 'QB', player: L('t1', 9) }, { slot: 'RB', player: L('k1', 8) }];
  const w = week(8, [game(2026, 8, 1, a, b)]);
  w.played = false;
  return w;
}
const m = (roster_id: number, starters: string[] | null, players: string[] | null, pp: Record<string, number>, points: number): SleeperMatchup =>
  ({ roster_id, matchup_id: 1, points, custom_points: null, starters, players, players_points: pp });

describe('liveWeek', () => {
  it('lays live points over each side by roster, keeping projections and the played flag', () => {
    const w = liveWeek(synced(), managers, [
      m(1, ['q1', 'r1'], ['q1', 'r1', 'w1'], { q1: 18.4, r1: 3, w1: 9 }, 21.4),
      m(2, ['t1', 'k1'], ['t1', 'k1'], { t1: 4 }, 4),
    ], null);
    const [a, b] = w.games[0].sides;
    expect(w.played).toBe(false);
    expect(a.points).toBe(21.4);
    expect(a.projected).toBe(35);
    expect(a.starters.map((e) => [e.slot, e.player?.playerId, e.player?.points, e.player?.projected])).toEqual([['QB', 'q1', 18.4, 20], ['RB', 'r1', 3, 15]]);
    expect(a.bench.map((l) => [l.playerId, l.points, l.projected])).toEqual([['w1', 9, 12]]);
    expect(b.starters[1].player?.points).toBe(0);
  });
  it('takes the lineup set since the sync, with no projection for a player the sync never saw', () => {
    const w = liveWeek(synced(), managers, [
      m(1, ['q1', 'w1'], ['q1', 'r1', 'w1'], { q1: 10, w1: 6 }, 16),
      m(2, ['t1', 'x9'], ['t1', 'x9'], { x9: 5 }, 5),
    ], null);
    const [a, b] = w.games[0].sides;
    expect(a.starters.map((e) => e.player?.playerId)).toEqual(['q1', 'w1']);
    expect(a.starters[1].player?.projected).toBe(12);
    expect(a.bench.map((l) => l.playerId)).toEqual(['r1']);
    expect(b.starters[1].player).toMatchObject({ playerId: 'x9', points: 5, projected: null });
  });
  it('keeps the synced starters when a team set no lineup, and an empty slot stays empty', () => {
    const w = liveWeek(synced(), managers, [m(1, [], null, {}, 0), m(2, ['t1', '0'], ['t1'], {}, 0)], null);
    expect(w.games[0].sides[0].starters.map((e) => e.player?.playerId)).toEqual(['q1', 'r1']);
    expect(w.games[0].sides[0].bench.map((l) => l.playerId)).toEqual(['w1']);
    expect(w.games[0].sides[1].starters[1].player).toBeNull();
  });
  it('replaces stat lines with live ones, trimmed to the kept keys, when live stats are loaded', () => {
    const w = liveWeek(synced(), managers, [m(1, ['q1', 'r1'], ['q1', 'r1'], { q1: 5 }, 5), m(2, ['t1', 'k1'], ['t1', 'k1'], {}, 0)],
      { q1: { pass_yd: 120, pass_att: 14, gms_active: 1 } });
    expect(w.games[0].sides[0].starters[0].player?.stats).toEqual({ pass_yd: 120, pass_att: 14 });
    expect(w.games[0].sides[0].starters[1].player?.stats).toEqual({});
  });
  it('re-adds each side\'s projected total from the starters it now has', () => {
    const w = liveWeek(synced(), managers, [m(1, ['q1', 'w1'], ['q1', 'r1', 'w1'], {}, 0), m(2, ['t1', '0'], ['t1'], {}, 0)], null);
    expect(w.games[0].sides[0].projected).toBe(32); // q1 20 + w1 12
    expect(w.games[0].sides[1].projected).toBe(9); // empty slot counts 0
  });
  it('scores fresh projections with the league scoring when they are loaded, including pickups the sync never saw', () => {
    const fresh = { q1: { pass_yd: 250, pass_td: 2 }, r1: { rush_yd: 50 }, x9: { rec: 4, rec_yd: 60 } };
    const scoring = { pass_yd: 0.04, pass_td: 4, rush_yd: 0.1, rec: 1, rec_yd: 0.1 };
    const w = liveWeek(synced(), managers, [m(1, ['q1', 'r1'], ['q1', 'r1'], {}, 0), m(2, ['t1', 'x9'], ['t1', 'x9'], {}, 0)], null, { map: fresh, scoring });
    const [a, b] = w.games[0].sides;
    expect(a.starters.map((e) => e.player?.projected)).toEqual([18, 5]);
    expect(a.projected).toBe(23);
    expect(b.starters.map((e) => e.player?.projected)).toEqual([null, 10]); // t1 has no fresh row
    expect(b.projected).toBe(10);
  });
  it('leaves a side with no matching roster as synced', () => {
    const w = liveWeek(synced(), managers, [m(2, ['t1', 'k1'], ['t1', 'k1'], { t1: 3 }, 3)], null);
    expect(w.games[0].sides[0].starters[0].player?.stats).toEqual({ pass_yd: 1 });
    expect(w.games[0].sides[1].points).toBe(3);
  });
});

describe('liveWeekNumber', () => {
  const s = () => { const x = season(2026, [week(1, []), synced()]); x.weeks[0] = { ...synced(), week: 1 }; x.weeks[1] = synced(); return x; };
  it('is Sleeper\'s week when the sync has that week with games', () => {
    expect(liveWeekNumber(s(), { season: '2026', season_type: 'regular', week: 2 })).toBe(2);
  });
  it('is null for a week the sync has already marked played', () => {
    const done = s(); done.weeks[1] = { ...synced(), played: true };
    expect(liveWeekNumber(done, { season: '2026', season_type: 'regular', week: 2 })).toBeNull();
  });
  it('is null for another season, the offseason, or a week the sync lacks or has no games for', () => {
    expect(liveWeekNumber(s(), { season: '2025', season_type: 'regular', week: 2 })).toBeNull();
    expect(liveWeekNumber(s(), { season: '2026', season_type: 'off', week: 2 })).toBeNull();
    expect(liveWeekNumber(s(), { season: '2026', season_type: 'regular', week: 3 })).toBeNull();
    const empty = s(); empty.weeks[1] = week(2, []);
    expect(liveWeekNumber(empty, { season: '2026', season_type: 'regular', week: 2 })).toBeNull();
    expect(liveWeekNumber(s(), null)).toBeNull();
  });
});

describe('tickerWeek', () => {
  const s = (lastScoredWeek: number) => { const x = season(2026, [{ ...synced(), week: 1, played: true }, synced()], null, lastScoredWeek); x.status = 'in_season'; return x; };
  it('is the live week when there is one, else the next week to play, else the last one played', () => {
    expect(tickerWeek(s(1), 1)?.week).toBe(1);
    expect(tickerWeek(s(1), null)?.week).toBe(8);
    expect(tickerWeek(s(2), null)?.week).toBe(8);
  });
  it('is null once the season is complete', () => {
    const done = s(2); done.status = 'complete';
    expect(tickerWeek(done, null)).toBeNull();
  });
});
