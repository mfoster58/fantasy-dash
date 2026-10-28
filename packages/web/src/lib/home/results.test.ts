import { game, line, players, side, week } from '../../test/playerFixtures';
import { crawlPerformers, fullStatLine, scoredSoFar, topPerformers, weekHitters } from './results';

describe('scoredSoFar', () => {
  it('a week in progress counts whoever leads as the winner, by the current margin; level games have none', () => {
    const w = week(7, [game(2026, 7, 1, side('a', 0, []), side('b', 0, [])), game(2026, 7, 2, side('c', 0, []), side('d', 0, []))]);
    w.played = false;
    w.games[0].sides[0].points = 61.2; w.games[0].sides[1].points = 78.4;
    w.games[1].sides[0].points = 40; w.games[1].sides[1].points = 40;
    const now = scoredSoFar(w);
    expect(now.games[0].winner).toBe('b');
    expect(now.games[0].margin).toBeCloseTo(17.2, 6);
    expect(now.games[1].winner).toBeNull();
    expect(now.games[1].margin).toBe(0);
    expect(weekHitters(now).map((h) => h.kind)).toEqual(['high', 'blowout', 'nail']);
  });
});

describe('weekHitters', () => {
  const w = week(6, [
    game(2026, 6, 1, side('a', 159.98, []), side('b', 120, [])),   // margin 39.98
    game(2026, 6, 2, side('c', 140, []), side('d', 76.6, [])),     // margin 63.4
    game(2026, 6, 3, side('e', 101, []), side('f', 93.6, [])),     // margin 7.4
  ]);
  it('high score, blowout, nail-biter: winner over loser with the number', () => {
    expect(weekHitters(w)).toEqual([
      { kind: 'high', userId: 'a', loser: null, value: 159.98, matchupId: 1 },
      { kind: 'blowout', userId: 'c', loser: 'd', value: 63.4, matchupId: 2 },
      { kind: 'nail', userId: 'e', loser: 'f', value: 7.4, matchupId: 3 },
    ].map((h) => ({ ...h, value: expect.closeTo(h.value, 6) })));
  });
  it('ties go to the lower matchup id, a tied game is no blowout or nail-biter, and an empty week has none', () => {
    const t = week(6, [game(2026, 6, 2, side('c', 100, []), side('d', 90, [])), game(2026, 6, 1, side('a', 100, []), side('b', 90, [])), game(2026, 6, 3, side('e', 80, []), side('f', 80, []))]);
    expect(weekHitters(t).map((h) => [h.kind, h.userId])).toEqual([['high', 'a'], ['blowout', 'a'], ['nail', 'a']]);
    expect(weekHitters(week(6, []))).toEqual([]);
  });
});

describe('topPerformers', () => {
  it('the top starters by points, ties by player name, bench and empty slots ignored', () => {
    const a = side('a', 0, [line('q1', 30.7, { pass_att: 30 }), line('w1', 20)], [line('t1', 50)]);
    a.starters.push({ slot: 'FLEX', player: null });
    const b = side('b', 0, [line('r1', 20), line('k1', 5)]);
    const top = topPerformers(week(6, [game(2026, 6, 1, a, b)]), players, 3);
    expect(top.map((p) => [p.playerId, p.userId, p.points])).toEqual([['q1', 'a', 30.7], ['r1', 'b', 20], ['w1', 'a', 20]]);
  });
  it('can keep to one position', () => {
    const a = side('a', 0, [line('q1', 30.7), line('w1', 20)]);
    const b = side('b', 0, [line('r1', 20), line('k1', 5)]);
    const w = week(6, [game(2026, 6, 1, a, b)]);
    expect(topPerformers(w, players, 5, 'WR').map((p) => p.playerId)).toEqual(['w1']);
    expect(topPerformers(w, players, 5, 'All').map((p) => p.playerId)).toEqual(['q1', 'r1', 'w1', 'k1']);
  });
});

describe('crawlPerformers', () => {
  it('ranks every starter by points, kickers and defenses left out, up to n', () => {
    const a = side('a', 0, [line('q1', 30.7), line('w1', 20)]);
    const b = side('b', 0, [line('r1', 22), line('k1', 25)]);
    b.starters.push({ slot: 'DEF', player: { playerId: 'DET', points: 40, projected: null, stats: {} } });
    const w = week(6, [game(2026, 6, 1, a, b)]);
    const dir = { ...players, DET: { id: 'DET', name: 'Detroit Lions', firstName: 'Detroit', lastName: 'Lions', position: 'DEF', team: 'DET', yearsExp: 0, birthDate: null } };
    expect(crawlPerformers(w, dir, 20).map((p) => p.playerId)).toEqual(['q1', 'r1', 'w1']);
    expect(crawlPerformers(w, dir, 2).map((p) => p.playerId)).toEqual(['q1', 'r1']);
  });
});

describe('fullStatLine', () => {
  it('rushing and receiving with targets, fumbles, no zero parts', () => {
    expect(fullStatLine({ rush_att: 16, rush_yd: 64, rush_td: 2, rec: 9, rec_tgt: 10, rec_yd: 53, fum_lost: 1 })).toBe('16 car, 64 yds, 2 TD · 9/10 rec, 53 yds · 1 fum');
    expect(fullStatLine({ rec: 12, rec_tgt: 15, rec_yd: 165 })).toBe('12/15 rec, 165 yds');
  });
  it('passing, kicking and defense', () => {
    expect(fullStatLine({ pass_cmp: 23, pass_att: 41, pass_yd: 313, pass_td: 2, pass_int: 1, rush_att: 3, rush_yd: 12 })).toBe('23/41, 313 yds, 2 TD, 1 INT · 3 car, 12 yds');
    expect(fullStatLine({ fgm: 3, fga: 4, xpm: 2, xpa: 2 })).toBe('3/4 FG, 2/2 XP');
    expect(fullStatLine({ sack: 2, int: 1, def_td: 1, pts_allow: 10 })).toBe('2 sck, 1 INT, 1 TD');
    expect(fullStatLine({})).toBe('');
  });
});
