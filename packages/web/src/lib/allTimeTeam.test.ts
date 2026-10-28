import { allTimeTeam, fillSlots, SLOTS } from './allTimeTeam';
import { flattenLines } from './playerLines';
import { game, line, players, season, side, week } from '../test/playerFixtures';

describe('fillSlots', () => {
  it('fills QB, RB, RB, WR, WR, TE, FLEX, DEF, K best-first, one entry per player, FLEX from the best RB/WR/TE left', () => {
    const c = (playerId: string, position: string, points: number) => ({ playerId, position, points });
    const out = fillSlots([c('q', 'QB', 30), c('q', 'QB', 35), c('r1', 'RB', 20), c('r2', 'RB', 18), c('r3', 'RB', 25), c('w1', 'WR', 15), c('w2', 'WR', 10), c('t', 'TE', 8), c('k', 'K', 9), c('d', 'DEF', 12)]);
    expect(out.map((o) => o.slot)).toEqual([...SLOTS]);
    expect(out.map((o) => o.pick && [o.pick.playerId, o.pick.points])).toEqual([['q', 35], ['r3', 25], ['r1', 20], ['w1', 15], ['w2', 10], ['t', 8], ['r2', 18], ['d', 12], ['k', 9]]);
  });
  it('leaves a slot empty when nobody fits', () => {
    expect(fillSlots([{ playerId: 'q', position: 'QB', points: 1 }]).filter((o) => o.pick).map((o) => o.slot)).toEqual(['QB']);
  });
});

describe('allTimeTeam', () => {
  const s = season(2025, [
    week(1, [game(2025, 1, 1, side('a', 50, [line('q1', 20), line('r1', 10)], [line('w1', 7)]), side('b', 12, [line('t1', 12)]))]),
    week(2, [game(2025, 2, 1, side('a', 48, [line('q1', 30, { pass_yd: 310, pass_td: 3 }), line('r1', 12)], [line('w1', 25)]), side('b', 12, [line('t1', 12)]))]),
  ]);
  s.playerSeasons = { q1: { points: 50, games: 2, posRank: 2 } };
  const team = allTimeTeam(flattenLines([s], players), 'a', [s]);

  it('sums each player-season on the roster, bench weeks included, with games played, PPG and the position rank', () => {
    const picks = Object.fromEntries(team.season.filter((o) => o.pick).map((o) => [o.slot, o.pick]));
    expect(picks.QB).toMatchObject({ playerId: 'q1', year: 2025, points: 50, games: 2, ppg: 25, posRank: 2 });
    expect(picks.RB).toMatchObject({ playerId: 'r1', points: 22, posRank: null });
    expect(picks.WR).toMatchObject({ playerId: 'w1', points: 32 });
    expect(team.season.filter((o) => o.pick === null).map((o) => o.slot)).toEqual(['RB', 'WR', 'TE', 'FLEX', 'DEF', 'K']);   // t1 belongs to bob
  });

  it("takes each player's best single game he started, with that game's stats, and links it to the box score", () => {
    const picks = Object.fromEntries(team.game.filter((o) => o.pick).map((o) => [o.slot, o.pick]));
    expect(picks.QB).toMatchObject({ playerId: 'q1', year: 2025, week: 2, matchupId: 1, points: 30, stats: { pass_yd: 310, pass_td: 3 } });
    // w1 only ever sat on the bench: a bench game never makes the team
    expect(picks.WR).toBeUndefined();
  });
});
