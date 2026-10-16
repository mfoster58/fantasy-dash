import { describe, it, expect } from 'vitest';
import { boardsFor } from '../../playerBoards';
import { standing } from '../../../test/playerFixtures';
import { mctx } from './shared.test';
import { msAgainst, msAllPlay, msBench, msDiff, msEfficiency, msFewest, msLucky, msNoTitle, msPoints, msPpg, msRecord, msUnlucky, msWorstAllPlay, msWorstEfficiency, msWorstRecord } from './seasons';

// 2024 (complete): a 1-0-1 pf 200 pa 170; b 0-1-1 pf 170 pa 200. 2025 in progress: a 0-1 70, b 1-0 100.
const ctx = mctx();
// a third manager-season with 4 games so the season rate minimum has something to pass
const deep = { ...ctx, managerSeasons: [...ctx.managerSeasons, { ...ctx.managerSeasons[0], userId: 'c', row: standing('c', 3, 3, 1, 0, 480, 400), games: 4, champion: false, runnerUp: false, playoffBerth: false, lastPlace: false, seed: 3 }] };

describe('manager season boards', () => {
  it('ranks whole seasons under the in-progress rule: complete seasons under All-time, the chosen year otherwise', () => {
    expect(msPoints(ctx).map((r) => [r.userId, r.meta, r.value])).toEqual([['a', '2024', 200], ['b', '2024', 170]]);
    expect(msFewest(ctx)[0]).toMatchObject({ userId: 'b', value: 170 });
    expect(msPoints(mctx(2025)).map((r) => [r.userId, r.value])).toEqual([['b', 100], ['a', 70]]);
    expect(msAgainst(ctx)[0]).toMatchObject({ userId: 'b', value: 200 });
  });
  it('needs 3 games for rate boards', () => {
    expect(msPpg(ctx)).toEqual([]);
    expect(msPpg(deep)).toEqual([expect.objectContaining({ userId: 'c', value: 120, valueLabel: '120.0' })]);
    expect(msRecord(deep)).toEqual([expect.objectContaining({ userId: 'c', value: 0.75, valueLabel: '3-1', detail: '.750 · 480.00 pts' })]);
    expect(msWorstRecord(deep)[0]).toMatchObject({ valueLabel: '3-1' });
    expect(msWorstRecord(deep)[0].userId).toBe('c');
  });
  it('shows the differential signed with a tone', () => {
    expect(msDiff(ctx).map((r) => [r.userId, r.valueLabel, r.tone])).toEqual([['a', '+30.0', 'win'], ['b', '-30.0', 'loss']]);
  });
  it('rates all-play and luck from the standings row', () => {
    const c = msAllPlay(deep)[0];
    expect(c).toMatchObject({ userId: 'c', detail: '6-2 all-play' });
    expect(c.valueLabel).toBe('.750');
    expect(msWorstAllPlay(deep)[0].userId).toBe('c');
    // luck = actual wins (ties half) − all-play % × games: c has 3 wins over 4 games at .750 → 0.0
    expect(msLucky(deep)[0]).toMatchObject({ userId: 'c', valueLabel: '0.0' });
    expect(msUnlucky(deep)[0].userId).toBe('c');
  });
  it('lists the best non-champion by all-play among complete seasons only', () => {
    expect(msNoTitle(deep).map((r) => r.userId)).toEqual(['c']);
    expect(msNoTitle(mctx(2025))).toEqual([]); // nobody is champion yet, so nobody is a non-champion either
  });
  it('rates season lineup efficiency over every game that season, with the 3-game minimum, and bench points without one', () => {
    // a 2024: 350 of 380 = 92.1%, bench 30; b 2024: 230 of 260 = 88.5%; both have only 2 regular-season games
    expect(msEfficiency(ctx)).toEqual([]);
    const three = { ...ctx, managerSeasons: ctx.managerSeasons.map((ms) => ({ ...ms, games: 3 })) };
    expect(msEfficiency(three).map((r) => [r.userId, r.valueLabel, r.detail])).toEqual([['a', '92.1%', '1-0-1'], ['b', '88.5%', '0-1-1']]);
    expect(msWorstEfficiency(three)[0].userId).toBe('b');
    expect(msWorstEfficiency(ctx)).toEqual([]);
    expect(msBench(ctx).map((r) => [r.userId, r.value])).toEqual([['a', 30], ['b', 30]]);
  });
  it('is registered in order', () => {
    expect(boardsFor('managers', 'mseasons').map((b) => b.id)).toEqual(['msPoints', 'msFewest', 'msPpg', 'msAgainst', 'msRecord', 'msWorstRecord', 'msDiff', 'msAllPlay', 'msWorstAllPlay', 'msLucky', 'msUnlucky', 'msEfficiency', 'msWorstEfficiency', 'msBench']);
  });
});
