import { describe, it, expect } from 'vitest';
import type { Draft, DraftPick } from '@fantasy-dash/core';
import { managerDraftSummaries, leagueExtremes, valueColor, posLabel } from './draft';

const pick = (pickNo: number, userId: string, value: number | null, pob: number): DraftPick => ({
  round: 1, pickNo, slot: pickNo, userId, playerId: `p${pickNo}`, isKeeper: false,
  posDraftRank: 1, seasonPoints: 100, posFinishRank: 1, value, pointsOverBaseline: pob,
});
const draft: Draft = { draftId: 'D', type: 'snake', rounds: 1, slotOrder: ['a', 'b'],
  picks: [pick(1, 'a', 5, 40), pick(2, 'b', -8, -20), pick(3, 'a', -2, 10), pick(4, 'b', 12, 60), pick(5, 'a', null, 5)] };

describe('managerDraftSummaries', () => {
  it('sums value and points over baseline per manager and finds best and worst picks', () => {
    const [first, second] = managerDraftSummaries(draft);
    expect(first).toMatchObject({ userId: 'a', picks: 3, totalValue: 3, totalPoB: 55 });
    expect(first.best?.pickNo).toBe(1);
    expect(first.worst?.pickNo).toBe(3);
    expect(second).toMatchObject({ userId: 'b', picks: 2, totalValue: 4, totalPoB: 40 });
    expect(second.best?.pickNo).toBe(4);
    expect(second.worst?.pickNo).toBe(2);
  });
});

describe('leagueExtremes', () => {
  it('returns the top steals and busts by value, ignoring unvalued picks', () => {
    const { steals, busts } = leagueExtremes(draft, 2);
    expect(steals.map((p) => p.pickNo)).toEqual([4, 1]);
    expect(busts.map((p) => p.pickNo)).toEqual([2, 3]);
  });
});

describe('valueColor and posLabel', () => {
  it('maps value to translucent win/loss colors clipped at 12', () => {
    expect(valueColor(null)).toBe('transparent');
    expect(valueColor(0)).toBe('transparent');
    expect(valueColor(6)).toBe('color-mix(in srgb, var(--win) 23%, transparent)');
    expect(valueColor(30)).toBe('color-mix(in srgb, var(--win) 38%, transparent)');
    expect(valueColor(-12)).toBe('color-mix(in srgb, var(--loss) 38%, transparent)');
  });
  it('formats positional draft rank', () => {
    expect(posLabel('RB', 7)).toBe('RB7');
    expect(posLabel('RB', null)).toBe('RB');
  });
});
