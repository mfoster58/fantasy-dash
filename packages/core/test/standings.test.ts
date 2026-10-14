import { describe, it, expect } from 'vitest';
import { computeStreak, computeStandings } from '../src/standings';
import type { Week, Game, GameSide } from '../src/types';

/** Build a minimal GameSide; ceiling defaults to points (perfect efficiency). */
function side(userId: string, points: number, ceiling = points): GameSide {
  return {
    userId, points, projected: 0, ceiling,
    efficiency: ceiling ? points / ceiling : 0,
    starters: [], bench: [], optimalSwaps: [],
    recordBefore: { w: 0, l: 0, t: 0 }, seasonPpg: 0,
  };
}

function game(week: number, matchupId: number, a: GameSide, b: GameSide): Game {
  const winner = a.points > b.points ? a.userId : b.points > a.points ? b.userId : null;
  return { id: `2024-${week}-${matchupId}`, matchupId, week, tag: null, sides: [a, b], winner, margin: Math.abs(a.points - b.points) };
}

function week(n: number, games: Game[], played = true, playoffWeekStart = 4): Week {
  const isPlayoff = n >= playoffWeekStart;
  const all = games.flatMap((g) => g.sides);
  const top = all.length ? all.reduce((m, s) => (s.points > m.points ? s : m)) : null;
  return { week: n, isPlayoff, played, games, highScore: played && !isPlayoff && top ? top.userId : null };
}

describe('computeStreak', () => {
  it('counts the trailing run', () => {
    expect(computeStreak(['W', 'L', 'L'])).toBe('L2');
    expect(computeStreak(['L', 'W', 'W', 'W'])).toBe('W3');
  });
  it('returns - for empty or trailing tie', () => {
    expect(computeStreak([])).toBe('-');
    expect(computeStreak(['W', 'T'])).toBe('-');
  });
});

describe('computeStandings', () => {
  // 4 teams, 3 regular-season weeks, playoffs start week 4.
  const weeks: Week[] = [
    week(1, [game(1, 1, side('A', 100), side('B', 90)), game(1, 2, side('C', 80), side('D', 70))]),
    week(2, [game(2, 1, side('A', 60, 82), side('C', 110)), game(2, 2, side('B', 95), side('D', 95))]),
    week(3, [game(3, 1, side('A', 120), side('D', 50)), game(3, 2, side('B', 70), side('C', 130))]),
    week(4, [game(4, 1, side('C', 999), side('A', 1))]),           // playoff: must be ignored
    week(5, [game(5, 1, side('A', 0), side('B', 0))], false, 99),  // unplayed: must be ignored
  ];
  const rows = computeStandings(weeks, ['A', 'B', 'C', 'D'], 4);
  const by = Object.fromEntries(rows.map((r) => [r.userId, r]));

  it('ranks by wins then points for', () => {
    expect(rows.map((r) => r.userId)).toEqual(['C', 'A', 'B', 'D']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it('computes W L T, win pct, PF, PA, PPG', () => {
    expect(by.A).toMatchObject({ w: 2, l: 1, t: 0, winPct: 0.6667, pf: 280, pa: 250, ppg: 93.33 });
    expect(by.B).toMatchObject({ w: 0, l: 2, t: 1, winPct: 0.1667, pf: 255, pa: 325 });
    expect(by.C).toMatchObject({ w: 3, l: 0, t: 0, winPct: 1, pf: 320, pa: 200 });
    expect(by.D).toMatchObject({ w: 0, l: 2, t: 1, pf: 215, pa: 295 });
  });

  it('computes max points and efficiency from ceilings', () => {
    expect(by.A.maxPoints).toBe(302);
    expect(by.A.efficiency).toBe(0.9272);
    expect(by.C.efficiency).toBe(1);
  });

  it('computes streaks', () => {
    expect(by.A.streak).toBe('W1');
    expect(by.B.streak).toBe('L1');
    expect(by.C.streak).toBe('W3');
  });

  it('computes all-play records', () => {
    expect(by.A.allPlay).toEqual({ w: 5, l: 4, t: 0, pct: 0.5556 });
    expect(by.B.allPlay).toEqual({ w: 4, l: 4, t: 1, pct: 0.5 });
    expect(by.C.allPlay).toEqual({ w: 7, l: 2, t: 0, pct: 0.7778 });
    expect(by.D.allPlay).toEqual({ w: 1, l: 7, t: 1, pct: 0.1667 });
  });

  it('counts weekly high scores', () => {
    expect(by.A.weeklyHighs).toBe(1);
    expect(by.C.weeklyHighs).toBe(2);
    expect(by.B.weeklyHighs).toBe(0);
  });

  it('returns zero rows for managers with no games', () => {
    const r = computeStandings(weeks, ['Z'], 4)[0];
    expect(r).toMatchObject({ userId: 'Z', w: 0, l: 0, t: 0, pf: 0, ppg: 0, streak: '-', efficiency: 0 });
  });
});
