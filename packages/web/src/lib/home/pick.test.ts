import type { GameSide, Season, Week } from '@fantasy-dash/core';
import { game, season, side, standing, week } from '../../test/playerFixtures';
import { gameScore, homeWeek, pickGames, recentAvg } from './pick';

/** a side with a record entering the week and a season scoring average */
const team = (userId: string, w: number, l: number, ppg: number): GameSide => {
  const s = side(userId, 0, []); s.recordBefore = { w, l, t: 0 }; s.seasonPpg = ppg; s.projected = 999; return s;
};
/** played weeks 1-3 where each user scores the given points */
const history = (scores: Record<string, number[]>): Week[] => [0, 1, 2].map((i) => {
  const ids = Object.keys(scores);
  const games = [];
  for (let j = 0; j < ids.length; j += 2) games.push(game(2026, i + 1, j / 2 + 1, side(ids[j], scores[ids[j]][i], []), side(ids[j + 1], scores[ids[j + 1]][i], [])));
  return week(i + 1, games);
});
function league(upcoming: Week, past: Week[], ranks: string[]): Season {
  const s = season(2026, [...past, upcoming], null, past.length);
  s.status = 'in_season';
  s.standings = ranks.map((u, i) => standing(u, i + 1, 0, 0, 0, 0, 0));
  return s;
}

describe('gameScore', () => {
  const rank = (r: Record<string, number>) => (u: string) => r[u] ?? null;
  it('is 1 for two identical top teams and falls with record gap, scoring gap and lower stakes', () => {
    const top = gameScore(game(2026, 4, 1, team('a', 2, 1, 120), team('b', 2, 1, 120)), rank({ a: 1, b: 2 }), 2);
    expect(top).toBeCloseTo(0.5625, 4); // recordClose 1, scoringClose 1, stakes (1 + 0.5)/2 = 0.75, squared
    const gap = gameScore(game(2026, 4, 1, team('a', 3, 0, 120), team('b', 0, 3, 120)), rank({ a: 1, b: 2 }), 2);
    expect(gap).toBe(0);
    const scoring = gameScore(game(2026, 4, 1, team('a', 2, 1, 150), team('b', 2, 1, 100)), rank({ a: 1, b: 2 }), 2);
    expect(scoring).toBeLessThan(top);
  });
  it('survives week 1: no games played, no scoring, no ranks', () => {
    expect(gameScore(game(2026, 1, 1, team('a', 0, 0, 0), team('b', 0, 0, 0)), () => null, 0)).toBe(1);
  });
});

describe('recentAvg', () => {
  it('averages the last three regular-season scores before the week, or null with none', () => {
    const s = league(week(4, []), history({ a: [10, 20, 30], b: [1, 2, 3] }), ['a', 'b']);
    expect(recentAvg(s, 'a', 4)).toBe(20);
    expect(recentAvg(s, 'a', 3)).toBe(15);
    expect(recentAvg(s, 'a', 1)).toBeNull();
  });
});

describe('pickGames', () => {
  // ranks: a1 b2 c3 d4 e5 f6 g7 h8
  const ranks = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const past = history({ a: [100, 100, 100], b: [100, 100, 100], c: [90, 90, 90], d: [140, 140, 140], e: [100, 100, 100], f: [100, 100, 100], g: [100, 100, 100], h: [100, 100, 100] });
  const wk = () => {
    const w = week(4, [
      game(2026, 4, 1, team('a', 3, 0, 130), team('h', 0, 3, 90)),   // #1 vs #8: lopsided
      game(2026, 4, 2, team('b', 2, 1, 120), team('e', 2, 1, 121)),   // close records, close scoring, good teams
      game(2026, 4, 3, team('c', 3, 0, 110), team('d', 1, 2, 115)),   // d has fewer wins, hotter lately: upset alert
      game(2026, 4, 4, team('f', 1, 2, 150), team('g', 1, 2, 149)),   // big scorers, low stakes
    ]);
    w.played = false;
    return w;
  };

  it('puts the close game between good teams in the banner and fills the slots by priority', () => {
    const w = wk();
    const p = pickGames(league(w, past, ranks), w, 'f');
    expect(p.hero?.matchupId).toBe(2);
    expect(p.sides.map((x) => [x.tag, x.game.matchupId])).toEqual([['upset', 3], ['champ', 4]]);
  });
  it('skips a tag with no game and moves on: no champion, so Top of the table', () => {
    const w = wk();
    expect(pickGames(league(w, past, ranks), w, null).sides.map((x) => x.tag)).toEqual(['upset', 'top']);
  });
  it('never gives the banner game a tag: the champion playing in it skips Champ watch', () => {
    const w = wk();
    expect(pickGames(league(w, past, ranks), w, 'b').sides.map((x) => x.tag)).toEqual(['upset', 'top']);
  });
  it('ignores projections', () => {
    const w = wk();
    w.games.forEach((g, i) => { g.sides[0].projected = i * 50; g.sides[1].projected = 300 - i * 50; });
    const p = pickGames(league(w, past, ranks), w, 'f');
    expect([p.hero?.matchupId, ...p.sides.map((x) => x.game.matchupId)]).toEqual([2, 3, 4]);
  });
  it('breaks a tie on combined scoring, then the lower matchup id', () => {
    const w = week(4, [game(2026, 4, 1, team('a', 1, 1, 100), team('b', 1, 1, 100)), game(2026, 4, 2, team('c', 1, 1, 110), team('d', 1, 1, 110))]);
    const s = league(w, [], []);
    expect(pickGames(s, w, null).hero?.matchupId).toBe(2);
    w.games[1].sides.forEach((x) => { x.seasonPpg = 100; });
    expect(pickGames(s, w, null).hero?.matchupId).toBe(1);
  });
  it('handles week 1 and short weeks: one game gives a banner and no sides, no games gives nothing', () => {
    const one = week(1, [game(2026, 1, 1, team('a', 0, 0, 0), team('b', 0, 0, 0))]);
    expect(pickGames(league(one, [], []), one, null)).toMatchObject({ hero: { matchupId: 1 }, sides: [] });
    const none = week(1, []);
    expect(pickGames(league(none, [], []), none, null)).toEqual({ hero: null, sides: [] });
  });
  it('playoff weeks: the championship in the banner, the next bracket games beside it, by tag order', () => {
    const w = week(17, [
      game(2026, 17, 3, team('e', 0, 0, 0), team('f', 0, 0, 0), '5th'),
      game(2026, 17, 1, team('a', 0, 0, 0), team('b', 0, 0, 0), 'Final'),
      game(2026, 17, 2, team('c', 0, 0, 0), team('d', 0, 0, 0), '3rd'),
      game(2026, 17, 4, team('g', 0, 0, 0), team('h', 0, 0, 0), 'Toilet Bowl'),
    ], true);
    const s = league(w, [], ranks);
    expect(pickGames(s, w, null)).toMatchObject({ hero: { matchupId: 1 }, sides: [{ tag: '3rd' }, { tag: '5th' }] });
    s.status = 'complete';
    expect(pickGames(s, w, null)).toMatchObject({ hero: { matchupId: 1 }, sides: [{ tag: '3rd' }, { tag: 'Toilet Bowl' }] });
  });
});

describe('homeWeek', () => {
  it('follows the ticker in season and falls back to the last week with games once the season is over', () => {
    const s = season(2026, [week(1, [game(2026, 1, 1, team('a', 0, 0, 0), team('b', 0, 0, 0))]), week(2, [])], null, 1);
    s.status = 'complete';
    expect(homeWeek(s, null)?.week).toBe(1);
    const empty = season(2026, [week(1, [])], null, 0);
    empty.status = 'in_season';
    expect(homeWeek(empty, null)).toBeNull();
  });
});
