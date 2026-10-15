import { describe, it, expect } from 'vitest';
import { flattenLines } from './playerLines';
import { longestStartRun } from './ironman';
import { game, line, players, season, side, week } from '../test/playerFixtures';

// league weeks: 2024 wk1-3, 2025 wk1-2
const seasons = [
  season(2024, [
    week(1, [game(2024, 1, 1, side('a', 10, [line('q1', 10)]), side('b', 5, [line('r1', 5)], [line('w1', 1)]))]),
    week(2, [game(2024, 2, 1, side('a', 10, [line('q1', 10)]), side('b', 5, [line('r1', 5)], [line('w1', 1)]))]),
    week(3, [game(2024, 3, 1, side('b', 10, [line('q1', 10)]), side('a', 5, [line('w1', 5)]))]),
  ]),
  season(2025, [
    week(1, [game(2025, 1, 1, side('a', 10, [line('q1', 10)]), side('b', 5, [line('w1', 5)]))]),
    week(2, [game(2025, 2, 1, side('a', 10, [line('r1', 10)]), side('b', 5, [line('w1', 5)]))]),
  ]),
];
const lines = flattenLines(seasons, players);

describe('longestStartRun', () => {
  it('counts consecutive league weeks started by any manager, across seasons', () => {
    const runs = longestStartRun(lines);
    expect(runs.get('q1')).toEqual({ length: 4, from: { year: 2024, week: 1 }, to: { year: 2025, week: 1 }, active: false });
  });
  it('ends at a missing week across seasons and never reports a stale run as active', () => {
    const runs = longestStartRun(lines);
    expect(runs.get('r1')).toEqual({ length: 2, from: { year: 2024, week: 1 }, to: { year: 2024, week: 2 }, active: false }); // 2025 wk2 is a new run of 1
  });
  it('bench weeks break a run; the latest week keeps it active', () => {
    const runs = longestStartRun(lines);
    expect(runs.get('w1')).toEqual({ length: 3, from: { year: 2024, week: 3 }, to: { year: 2025, week: 2 }, active: true });
  });
  it('keeps the earliest run on a tie and handles no lines', () => {
    const only = lines.filter((l) => l.playerId === 'r1');
    expect(longestStartRun(only).get('r1')!.from).toEqual({ year: 2024, week: 1 });
    expect(longestStartRun([]).size).toBe(0);
  });
});
