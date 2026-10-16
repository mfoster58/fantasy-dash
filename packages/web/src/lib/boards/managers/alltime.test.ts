import { describe, it, expect } from 'vitest';
import { boardsFor } from '../../playerBoards';
import { mctx } from './shared.test';
import { mBerths, mBerthsNoTitle, mCareerPoints, mCareerPpg, mCareerWins, mEfficiency, mFinals, mLastPlaces, mPlayoffWins, mPointsAgainst, mSeasons, mTitles, mWeeklyHighs, mWinPct, mWorstEfficiency, mWorstWinPct } from './alltime';

// fixture recap (shared.test): 2024 complete — a 1-0-1 (pf 200, pa 170), champion, b runner-up and last place; Final a 150–60.
// 2025 in progress — b 1-0 (100), a 0-1 (70). Games: a 120/80/150/70 with ceilings +10; b 90/80/60/100.
const ctx = mctx();
const pick = (rows: ReturnType<typeof mCareerWins>, id: string) => rows.find((r) => r.userId === id);

describe('manager all-time boards', () => {
  it('counts regular-season wins and shows the record', () => {
    expect(mCareerWins(ctx).map((r) => [r.userId, r.value, r.detail, r.meta])).toEqual([['a', 1, '1-1-1', '2024–2025 · 2 seasons'], ['b', 1, '1-1-1', '2024–2025 · 2 seasons']]);
  });
  it('rates win % with ties as half, only for managers with a complete season', () => {
    expect(pick(mWinPct(ctx), 'a')).toMatchObject({ valueLabel: '.500' });
    expect(mWorstWinPct(ctx)[0].value).toBeLessThanOrEqual(mWorstWinPct(ctx).at(-1)!.value);
    expect(mWinPct(mctx(2025))).toEqual([]); // no complete season in scope
  });
  it('sums points, points against and points per game over regular-season rows', () => {
    expect(pick(mCareerPoints(ctx), 'a')).toMatchObject({ value: 270, valueLabel: '270.00', detail: '3 games' });
    expect(pick(mPointsAgainst(ctx), 'a')).toMatchObject({ value: 270 });
    expect(pick(mCareerPpg(ctx), 'a')).toMatchObject({ value: 90, valueLabel: '90.0' });
  });
  it('counts honors, berths and playoff wins', () => {
    expect(mTitles(ctx)).toEqual([expect.objectContaining({ userId: 'a', value: 1 })]);
    expect(mFinals(ctx).map((r) => [r.userId, r.value])).toEqual([['a', 1], ['b', 1]]);
    expect(mBerths(ctx).map((r) => [r.userId, r.value])).toEqual([['a', 1], ['b', 1]]);
    expect(mPlayoffWins(ctx)).toEqual([expect.objectContaining({ userId: 'a', value: 1 })]);
    expect(mBerthsNoTitle(ctx)).toEqual([expect.objectContaining({ userId: 'b', value: 1 })]);
    expect(mLastPlaces(ctx)).toEqual([expect.objectContaining({ userId: 'b', value: 1 })]);
    expect(mSeasons(ctx).map((r) => r.value)).toEqual([2, 2]);
    expect(mWeeklyHighs(ctx)).toEqual([]); // fixture standings carry 0 highs
  });
  it('rates lineup efficiency over every game played, playoffs included', () => {
    // a: 420 of 460 = 91.3%; b: 330 of 370 = 89.2%
    expect(mEfficiency(ctx).map((r) => [r.userId, r.valueLabel])).toEqual([['a', '91.3%'], ['b', '89.2%']]);
    expect(mWorstEfficiency(ctx)[0].userId).toBe('b');
  });
  it('is registered in order', () => {
    expect(boardsFor('managers', 'malltime').map((b) => b.id)).toEqual(['mCareerWins', 'mWinPct', 'mWorstWinPct', 'mCareerPoints', 'mCareerPpg', 'mPointsAgainst', 'mTitles', 'mFinals', 'mBerths', 'mPlayoffWins', 'mBerthsNoTitle', 'mLastPlaces', 'mSeasons', 'mEfficiency', 'mWorstEfficiency', 'mWeeklyHighs']);
  });
});
