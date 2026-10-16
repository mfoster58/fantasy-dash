import { describe, it, expect } from 'vitest';
import { boardsFor } from '../../playerBoards';
import { mctx } from './shared.test';
import { mpBlowout, mpClosest, mpFinalsLost, mpHigh, mpLow, mpLowSeed, mpToiletApps, mpToiletWins } from './playoffs';

// the only championship-bracket game: 2024 wk3 Final, a 150–60 b. a is the 2024 champion as the 1 seed; b runner-up.
const ctx = mctx();
const toilet = { ...ctx, teamGames: [...ctx.teamGames, { ...ctx.teamGames[0], gameId: '2024-9-1', week: 9, tag: 'Toilet Bowl' as const, postseason: false, consolation: true }] };

describe('manager playoff boards', () => {
  it('ranks championship-bracket scores and margins', () => {
    expect(mpHigh(ctx)).toEqual([expect.objectContaining({ userId: 'a', value: 150, meta: '2024 · Wk 3 · Championship' }), expect.objectContaining({ userId: 'b', value: 60 })]);
    expect(mpLow(ctx)[0]).toMatchObject({ userId: 'b', value: 60 });
    expect(mpBlowout(ctx)).toEqual([expect.objectContaining({ userId: 'a', value: 90, detail: 'over bob, 150.00–60.00' })]);
    expect(mpClosest(ctx)).toHaveLength(1);
  });
  it('lists champions by seed, worst seed first, and Finals lost', () => {
    expect(mpLowSeed(ctx)).toEqual([expect.objectContaining({ userId: 'a', value: 1, valueLabel: '#1', meta: '2024', detail: '1-0-1 · 200.00 pts' })]);
    expect(mpFinalsLost(ctx)).toEqual([expect.objectContaining({ userId: 'b', value: 1 })]);
  });
  it('counts Toilet Bowl appearances and wins', () => {
    expect(mpToiletApps(ctx)).toEqual([]);
    expect(mpToiletApps(toilet)).toEqual([expect.objectContaining({ userId: 'a', value: 1, detail: '1 won' })]);
    expect(mpToiletWins(toilet)).toEqual([expect.objectContaining({ userId: 'a', value: 1 })]);
  });
  it('is registered in order', () => {
    expect(boardsFor('managers', 'mplayoffs').map((b) => b.id)).toEqual(['mpHigh', 'mpLow', 'mpBlowout', 'mpClosest', 'mpLowSeed', 'mpFinalsLost', 'mpToiletApps', 'mpToiletWins']);
  });
});
