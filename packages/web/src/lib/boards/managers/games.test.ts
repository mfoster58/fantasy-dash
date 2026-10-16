import { describe, it, expect } from 'vitest';
import { boardsFor } from '../../playerBoards';
import { mctx } from './shared.test';
import { mgBench, mgBlowout, mgClosest, mgCombinedHigh, mgCombinedLow, mgHigh, mgLossHigh, mgLow, mgPerfect, mgWinLow } from './games';

// games: 2024 wk1 a 120–90 b; wk2 80–80 tie; wk3 Final a 150–60 b; 2025 wk1 b 100–70 a. Every ceiling is points + 10.
const ctx = mctx();

describe('manager game boards', () => {
  it('ranks single scores high and low with the opponent and score', () => {
    expect(mgHigh(ctx)[0]).toMatchObject({ userId: 'a', value: 150, meta: '2024 · Wk 3 · Championship', detail: 'vs bob, 150.00–60.00', to: '/scores/2024/3/1' });
    expect(mgLow(ctx)[0]).toMatchObject({ userId: 'b', value: 60 });
  });
  it('finds the best score in a loss and the worst in a win; ties count as neither', () => {
    expect(mgLossHigh(ctx)[0]).toMatchObject({ userId: 'b', value: 90 });
    expect(mgWinLow(ctx)[0]).toMatchObject({ userId: 'b', value: 100 });
    expect(mgWinLow(ctx).some((r) => r.value === 80)).toBe(false);
  });
  it('ranks blowouts and closest games once per game, excluding ties, with the loser in the detail', () => {
    expect(mgBlowout(ctx)[0]).toMatchObject({ userId: 'a', value: 90, detail: 'over bob, 150.00–60.00' });
    expect(mgClosest(ctx)[0]).toMatchObject({ userId: 'b', value: 30, meta: '2025 · Wk 1' }); // two 30-point margins; the newer game ranks first
    expect(mgClosest(ctx)[1]).toMatchObject({ userId: 'a', value: 30, meta: '2024 · Wk 1' });
    expect(mgClosest(ctx)).toHaveLength(3);
  });
  it('ranks combined scores once per game, naming both managers', () => {
    expect(mgCombinedHigh(ctx)[0]).toMatchObject({ userId: 'a', value: 210, detail: 'with bob, 150.00–60.00' });
    expect(mgCombinedLow(ctx)[0]).toMatchObject({ value: 160, meta: '2024 · Wk 2' });
  });
  it('lists perfectly set lineups and points left on the bench', () => {
    expect(mgPerfect(ctx)).toEqual([]);
    const perfect = { ...ctx, teamGames: ctx.teamGames.map((g) => (g.userId === 'a' && g.week === 1 && g.year === 2024 ? { ...g, ceiling: 120, benchPoints: 0 } : g)) };
    expect(mgPerfect(perfect)).toEqual([expect.objectContaining({ userId: 'a', value: 120 })]);
    expect(mgBench(ctx)[0]).toMatchObject({ value: 10, detail: expect.stringMatching(/of .* possible/) });
  });
  it('is registered in order', () => {
    expect(boardsFor('managers', 'mgames').map((b) => b.id)).toEqual(['mgHigh', 'mgLow', 'mgLossHigh', 'mgWinLow', 'mgBlowout', 'mgClosest', 'mgCombinedHigh', 'mgCombinedLow', 'mgPerfect', 'mgBench']);
  });
});
