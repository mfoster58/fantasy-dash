import { describe, it, expect } from 'vitest';
import type { H2HGame, H2HSeries, History } from '@fantasy-dash/core';
import { longestStreaks } from './streaks';

const game = (year: number, week: number, aPoints: number, bPoints: number): H2HGame =>
  ({ gameId: `${year}-${week}-1`, year, week, tag: null, aPoints, bPoints });
const series = (a: string, b: string, games: H2HGame[]): H2HSeries => ({
  a, b, aWins: 0, bWins: 0, ties: 0, streak: { holder: null, length: 0 }, totalPoints: { a: 0, b: 0 },
  biggestWin: null, closest: null, avgMargin: 0, games,
});

// a beats b in 2024 wk 13, 14 and 2025 wk 1 (carry-over), ties wk 2, beats c wk 3, loses wk 4.
const h2h: History['h2h'] = {
  'a|b': series('a', 'b', [game(2024, 13, 100, 90), game(2024, 14, 100, 90), game(2025, 1, 100, 90), game(2025, 2, 95, 95)]),
  'a|c': series('a', 'c', [game(2025, 3, 100, 90), game(2025, 4, 80, 90)]),
  'b|c': series('b', 'c', [game(2024, 12, 70, 90), game(2025, 5, 70, 90)]),
};

describe('longestStreaks', () => {
  it('finds win streaks that carry across seasons and end on a tie', () => {
    const w = longestStreaks(h2h, 'W');
    expect(w[0]).toEqual({ userId: 'a', kind: 'W', length: 3, from: { year: 2024, week: 13 }, to: { year: 2025, week: 1 }, active: false });
  });
  it('reports one streak per manager, the longest, and marks it active when it includes their latest game', () => {
    // c: 2024 wk12 W (vs b), 2025 wk3 L (vs a), wk4 W, wk5 W → runs of 1 and 2; only the 2 is reported, and it is active.
    const w = longestStreaks(h2h, 'W');
    expect(w.filter((s) => s.userId === 'c')).toEqual([
      { userId: 'c', kind: 'W', length: 2, from: { year: 2025, week: 4 }, to: { year: 2025, week: 5 }, active: true },
    ]);
  });
  it('finds losing streaks separately', () => {
    // b: 2024 wk12 L, wk13 L, wk14 L, 2025 wk1 L, wk2 T, wk5 L → the tie ends the run at 4; the later 1-game run is active but shorter.
    const l = longestStreaks(h2h, 'L');
    expect(l[0]).toEqual({ userId: 'b', kind: 'L', length: 4, from: { year: 2024, week: 12 }, to: { year: 2025, week: 1 }, active: false });
  });
  it('orders by length, then most recent end, and caps at the limit', () => {
    const w = longestStreaks(h2h, 'W', 2);
    expect(w.map((s) => [s.userId, s.length])).toEqual([['a', 3], ['c', 2]]);
  });
  it('returns nothing for empty input or all ties', () => {
    expect(longestStreaks({}, 'W')).toEqual([]);
    expect(longestStreaks({ 'x|y': series('x', 'y', [game(2025, 1, 50, 50)]) }, 'W')).toEqual([]);
    expect(longestStreaks({ 'x|y': series('x', 'y', [game(2025, 1, 50, 50)]) }, 'L')).toEqual([]);
  });
});
