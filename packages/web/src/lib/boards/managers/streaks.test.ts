import { describe, it, expect } from 'vitest';
import { boardsFor } from '../../playerBoards';
import { mctx } from './shared.test';
import { longestGameRun, mHighRun, mLoseStreak, mPlayoffStreak, mRun100, mWinStreak } from './streaks';

// a: W (120), T, W (150, Final), L (70, 2025). b: L, T, L, W (100, 2025). Week 1 of 2024 high score: a.
const ctx = mctx();

describe('longestGameRun', () => {
  it('ends on a failing game, keeps the later of equal runs, and flags a run reaching the last game', () => {
    const a = ctx.teamGames.filter((g) => g.userId === 'a');
    expect(longestGameRun(a, (g) => g.result === 'W')).toMatchObject({ length: 1, from: { year: 2024, week: 3 }, to: { year: 2024, week: 3 }, active: false });
    expect(longestGameRun(a, (g) => g.result === 'L')).toMatchObject({ length: 1, from: { year: 2025, week: 1 }, active: true });
    expect(longestGameRun(a, () => false)).toBeNull();
    expect(longestGameRun([], () => true)).toBeNull();
  });
});

describe('manager streak boards', () => {
  it('ranks win and loss streaks with their span and an active flag', () => {
    expect(mWinStreak(ctx).map((r) => [r.userId, r.value, r.meta, r.detail])).toEqual([['b', 1, '2025 Wk 1 – 2025 Wk 1', 'active'], ['a', 1, '2024 Wk 3 – 2024 Wk 3', null]]);
    expect(mLoseStreak(ctx)[0]).toMatchObject({ userId: 'a', value: 1, detail: 'active' });
  });
  it('counts runs of 100-point games and weeks as high scorer', () => {
    expect(mRun100(ctx).map((r) => [r.userId, r.value, r.detail])).toEqual([['b', 1, 'active'], ['a', 1, null]]);
    expect(mHighRun(ctx)).toEqual([expect.objectContaining({ userId: 'a', value: 1, meta: '2024 Wk 1 – 2024 Wk 1' })]);
  });
  it('counts consecutive complete seasons with a berth, active when they reach the latest complete season', () => {
    expect(mPlayoffStreak(ctx).map((r) => [r.userId, r.value, r.meta, r.detail])).toEqual([['a', 1, '2024', 'active'], ['b', 1, '2024', 'active']]);
  });
  it('is registered in order', () => {
    expect(boardsFor('managers', 'mstreaks').map((b) => b.id)).toEqual(['mWinStreak', 'mLoseStreak', 'mPlayoffStreak', 'mRun100', 'mHighRun']);
  });
});
