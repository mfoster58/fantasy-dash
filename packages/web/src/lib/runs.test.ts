import { describe, it, expect } from 'vitest';
import { flattenLines } from './playerLines';
import { game, line, players, season, side, week } from '../test/playerFixtures';
import { longestLineRun } from './runs';

// q1 started by a every week: 20, 9, 25, 30 | 2025: 18. r1 started weeks 1-2 only.
const seasons = [
  season(2024, [
    week(1, [game(2024, 1, 1, side('a', 40, [line('q1', 20), line('r1', 20)]), side('b', 10, [line('w1', 10)]))]),
    week(2, [game(2024, 2, 1, side('a', 30, [line('q1', 9), line('r1', 21)]), side('b', 10, [line('w1', 10)]))]),
    week(3, [game(2024, 3, 1, side('a', 25, [line('q1', 25)], [line('r1', 40)]), side('b', 10, [line('w1', 10)]))]),
    week(4, [game(2024, 4, 1, side('a', 30, [line('q1', 30)]), side('b', 10, [line('w1', 10)]))]),
  ]),
  season(2025, [week(1, [game(2025, 1, 1, side('a', 18, [line('q1', 18)]), side('b', 10, [line('w1', 10)]))])]),
];
const lines = flattenLines(seasons, players);

describe('longestLineRun', () => {
  it('runs over started lines in order; a failing started line ends the run, a benched week does not', () => {
    const runs = longestLineRun(lines.filter((l) => l.started), (l) => l.points >= 15);
    expect(runs.get('q1')).toMatchObject({ length: 3, from: { year: 2024, week: 3 }, to: { year: 2025, week: 1 } });
    expect(runs.get('r1')).toMatchObject({ length: 2, from: { year: 2024, week: 1 }, to: { year: 2024, week: 2 } }); // the week-3 bench line is skipped, not a break
    expect(runs.get('w1')).toBeUndefined(); // never passes
  });
  it('keeps the earliest of two equal runs and the lines inside it', () => {
    const runs = longestLineRun(lines.filter((l) => l.started && l.playerId === 'q1'), (l) => l.points >= 18 && l.points < 30);
    expect(runs.get('q1')).toMatchObject({ length: 1, from: { year: 2024, week: 1 } });
    expect(runs.get('q1')!.lines.map((l) => l.points)).toEqual([20]);
  });
});
