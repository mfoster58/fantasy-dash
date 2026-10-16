import { describe, it, expect } from 'vitest';
import { boardsFor } from '../../playerBoards';
import { mctx } from './shared.test';
import { game, season, side, standing, week } from '../../../test/playerFixtures';
import { managerSeasonsOf, teamGamesOf } from '../../managerGames';
import { mBerths, mBerthsNoTitle, mCareerPoints, mCareerPpg, mCareerWins, mEfficiency, mFinals, mLastPlaces, mPlayoffWins, mLuckyWins, mPointsAgainst, mTitles, mUnluckyLosses, mWeeklyHighs, mWinPct, mWorstEfficiency, mWorstWinPct, weekMedians } from './alltime';

// fixture recap (shared.test): 2024 complete — a 1-0-1 (pf 200, pa 170), champion, b runner-up and last place; Final a 150–60.
// 2025 in progress — b 1-0 (100), a 0-1 (70). Games: a 120/80/150/70 with ceilings +10; b 90/80/60/100.
const ctx = mctx();
const pick = (rows: ReturnType<typeof mCareerWins>, id: string) => rows.find((r) => r.userId === id);

describe('manager all-time boards', () => {
  it('counts regular-season wins and shows the record', () => {
    expect(mCareerWins(ctx).map((r) => [r.userId, r.value, r.detail, r.meta])).toEqual([['a', 1, '1-1-1', '2024–2025'], ['b', 1, '1-1-1', '2024–2025']]);
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
    // honours list the years underneath rather than a season count
    expect(mTitles(ctx)).toEqual([expect.objectContaining({ userId: 'a', value: 1, detail: '2024' })]);
    expect(mFinals(ctx).map((r) => [r.userId, r.value])).toEqual([['a', 1], ['b', 1]]);
    expect(mBerths(ctx).map((r) => [r.userId, r.value, r.detail])).toEqual([['a', 1, '2024'], ['b', 1, '2024']]);
    expect(mPlayoffWins(ctx)).toEqual([expect.objectContaining({ userId: 'a', value: 1 })]);
    expect(mBerthsNoTitle(ctx)).toEqual([expect.objectContaining({ userId: 'b', value: 1, detail: '2024' })]);
    expect(mLastPlaces(ctx)).toEqual([expect.objectContaining({ userId: 'b', value: 1, detail: '2024' })]);
    expect(mWeeklyHighs(ctx)).toEqual([]); // fixture standings carry 0 highs
  });
  it('rates lineup efficiency over every game played, playoffs included', () => {
    // a: 420 of 460 = 91.3%; b: 330 of 370 = 89.2%
    expect(mEfficiency(ctx).map((r) => [r.userId, r.valueLabel, r.detail])).toEqual([['a', '91.3%', '4 games'], ['b', '89.2%', '4 games']]);
    expect(mWorstEfficiency(ctx)[0].userId).toBe('b');
  });
  it('is registered in order', () => {
    expect(boardsFor('managers', 'malltime').map((b) => b.id)).toEqual(['mCareerWins', 'mWinPct', 'mWorstWinPct', 'mCareerPoints', 'mCareerPpg', 'mPointsAgainst', 'mTitles', 'mFinals', 'mBerths', 'mPlayoffWins', 'mBerthsNoTitle', 'mLastPlaces', 'mEfficiency', 'mWorstEfficiency', 'mWeeklyHighs', 'mLuckyWins', 'mUnluckyLosses']);
  });

  it('counts wins under and losses over the week\'s league median score', () => {
    // scores 90, 100, 110, 120: median 105; a wins at 100 (lucky), d loses at 110 (unlucky)
    const s = season(2024, [week(1, [game(2024, 1, 1, side('a', 100, []), side('b', 90, [])), game(2024, 1, 2, side('c', 120, []), side('d', 110, []))])]);
    s.standings = [standing('c', 1, 1, 0, 0, 120, 110), standing('a', 2, 1, 0, 0, 100, 90), standing('d', 3, 0, 1, 0, 110, 120), standing('b', 4, 0, 1, 0, 90, 100)];
    const teamGames = teamGamesOf([s]);
    const c = { ...mctx(), teamGames, managerSeasons: managerSeasonsOf([s], teamGames) };
    expect(weekMedians(teamGames).get('2024-1')).toBe(105);
    expect(mLuckyWins(c)).toEqual([expect.objectContaining({ userId: 'a', value: 1, detail: 'of 1 win' })]);
    expect(mUnluckyLosses(c)).toEqual([expect.objectContaining({ userId: 'd', value: 1, detail: 'of 1 loss' })]);
    expect(mUnluckyLosses({ ...c, teamGames: [...teamGames, ...teamGames.map((g) => ({ ...g, week: 2, gameId: `${g.gameId}-2` }))] })[0].detail).toBe('of 2 losses');
    expect(mLuckyWins(ctx)).toEqual([]);   // two teams a week: the winner is never under the median
  });
});
