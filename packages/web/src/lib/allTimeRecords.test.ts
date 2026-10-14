import { describe, it, expect } from 'vitest';
import type { H2HGame, H2HSeries, History } from '@fantasy-dash/core';
import { allTimeRecords } from './allTimeRecords';

const game = (year: number, week: number, matchupId: number, aPoints: number, bPoints: number, tag: H2HGame['tag'] = null): H2HGame =>
  ({ gameId: `${year}-${week}-${matchupId}`, year, week, tag, aPoints, bPoints });

const series = (a: string, b: string, games: H2HGame[]): H2HSeries => ({
  a, b, aWins: 0, bWins: 0, ties: 0, streak: { holder: null, length: 0 }, totalPoints: { a: 0, b: 0 },
  biggestWin: null, closest: null, avgMargin: 0, games,
});

const h2h: History['h2h'] = {
  'a|b': series('a', 'b', [
    game(2025, 3, 1, 150.5, 100.25),        // blowout 50.25
    game(2024, 1, 2, 90, 90),               // tie
    game(2024, 10, 1, 120, 119.5),          // margin 0.5
  ]),
  'c|d': series('c', 'd', [
    game(2025, 16, 3, 80, 180, 'Final'),    // blowout 100, low 80, high 180
    game(2023, 5, 2, 110, 100),             // margin 10
  ]),
};

describe('allTimeRecords', () => {
  const r = allTimeRecords(h2h);

  it('ranks the highest team-week scores with their opponent and game link data', () => {
    expect(r.highScores.map((s) => [s.userId, s.points])).toEqual([['d', 180], ['a', 150.5], ['a', 120], ['b', 119.5], ['c', 110], ['b', 100.25], ['d', 100], ['a', 90], ['b', 90], ['c', 80]]);
    expect(r.highScores[0]).toEqual({ gameId: '2025-16-3', year: 2025, week: 16, tag: 'Final', userId: 'd', points: 180, opponent: 'c', oppPoints: 80 });
  });

  it('ranks the lowest team-week scores', () => {
    expect(r.lowScores.map((s) => [s.userId, s.points])).toEqual([['c', 80], ['a', 90], ['b', 90], ['d', 100], ['b', 100.25], ['c', 110], ['b', 119.5], ['a', 120], ['a', 150.5], ['d', 180]]);
  });

  it('ranks the closest matchups with ties first', () => {
    expect(r.closest.map((m) => m.margin)).toEqual([0, 0.5, 10, 50.25, 100]);
    expect(r.closest[0]).toEqual({ gameId: '2024-1-2', year: 2024, week: 1, tag: null, high: { userId: 'a', points: 90 }, low: { userId: 'b', points: 90 }, margin: 0 });
    expect(r.closest[1]).toMatchObject({ high: { userId: 'a', points: 120 }, low: { userId: 'b', points: 119.5 } });
  });

  it('ranks the biggest blowouts with the winner first', () => {
    expect(r.blowouts.map((m) => m.margin)).toEqual([100, 50.25, 10, 0.5, 0]);
    expect(r.blowouts[0]).toMatchObject({ gameId: '2025-16-3', high: { userId: 'd', points: 180 }, low: { userId: 'c', points: 80 } });
  });

  it('breaks equal scores by the most recent game first', () => {
    const tied: History['h2h'] = {
      'a|b': series('a', 'b', [game(2023, 2, 1, 100, 50), game(2025, 4, 1, 100, 60)]),
    };
    expect(allTimeRecords(tied).highScores.slice(0, 2).map((s) => s.gameId)).toEqual(['2025-4-1', '2023-2-1']);
  });

  it('caps each list at the limit', () => {
    const r3 = allTimeRecords(h2h, 3);
    expect(r3.highScores).toHaveLength(3);
    expect(r3.lowScores).toHaveLength(3);
    expect(r3.closest).toHaveLength(3);
    expect(r3.blowouts).toHaveLength(3);
  });

  it('returns empty lists when there are no games', () => {
    expect(allTimeRecords({})).toEqual({ highScores: [], lowScores: [], closest: [], blowouts: [] });
  });
});
