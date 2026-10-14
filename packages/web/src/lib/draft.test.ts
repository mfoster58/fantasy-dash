import { describe, it, expect } from 'vitest';
import type { Draft, DraftPick } from '@fantasy-dash/core';
import { managerDraftSummaries, leagueExtremes, topHealthyPpg, valueColor, posLabel } from './draft';

const pick = (pickNo: number, userId: string, value: number | null, pob: number, extra: Partial<DraftPick> = {}): DraftPick => ({
  round: 1, pickNo, slot: pickNo, userId, playerId: `p${pickNo}`, isKeeper: false,
  posDraftRank: 1, seasonPoints: 100, gamesPlayed: 5, ppg: 20, healthy: true,
  pointsOverBaseline: pob, redraftPos: 1, slotValue: value === null ? null : value / 2, productionValue: value === null ? null : value / 2, value, tradedTo: null, ...extra,
});
const draft: Draft = { draftId: 'D', type: 'snake', rounds: 1, slotOrder: ['a', 'b'], expectedCurve: { a: 40, k: 36, c: 0 },
  picks: [pick(1, 'a', 5, 40), pick(2, 'b', -8, -20), pick(3, 'a', -2, 10), pick(4, 'b', 12, 60), pick(5, 'a', null, 5)] };

describe('managerDraftSummaries', () => {
  it('sums value parts and points over baseline per manager, finds best and worst, sorts by value', () => {
    const [first, second] = managerDraftSummaries(draft);
    expect(first).toMatchObject({ userId: 'b', picks: 2, totalValue: 4, totalSlot: 2, totalProduction: 2, totalPoB: 40 });
    expect(first.best?.pickNo).toBe(4);
    expect(first.worst?.pickNo).toBe(2);
    expect(second).toMatchObject({ userId: 'a', picks: 3, totalValue: 3, totalPoB: 55 });
    expect(second.best?.pickNo).toBe(1);
    expect(second.worst?.pickNo).toBe(3);
  });
});

describe('leagueExtremes', () => {
  it('returns the top steals and busts by value, ignoring unvalued picks, 10 by default', () => {
    const { steals, busts } = leagueExtremes(draft, 2);
    expect(steals.map((p) => p.pickNo)).toEqual([4, 1]);
    expect(busts.map((p) => p.pickNo)).toEqual([2, 3]);
    expect(leagueExtremes(draft).steals).toHaveLength(4);
  });
});

describe('topHealthyPpg', () => {
  it('keeps healthy, valued picks with games, sorted by ppg then points', () => {
    const d: Draft = { ...draft, picks: [
      pick(1, 'a', 5, 40, { ppg: 18 }),
      pick(2, 'b', -8, -20, { ppg: 25, healthy: false }),
      pick(3, 'a', -2, 10, { ppg: 22 }),
      pick(4, 'b', null, 60, { ppg: 30 }),               // DEF-like: no value
      pick(5, 'a', 1, 5, { ppg: 22, seasonPoints: 120 }),
      pick(6, 'b', 1, 5, { ppg: null, gamesPlayed: 0 }),
    ] };
    expect(topHealthyPpg(d).map((p) => p.pickNo)).toEqual([5, 3, 1]);
    expect(topHealthyPpg(d, 1).map((p) => p.pickNo)).toEqual([5]);
  });
});

describe('valueColor and posLabel', () => {
  it('maps value onto a muted red-yellow-green tint saturating at 120', () => {
    expect(valueColor(null)).toBe('transparent');
    expect(valueColor(0)).toBe('color-mix(in srgb, #e6c229 30%, transparent)');
    expect(valueColor(30)).toBe('color-mix(in srgb, color-mix(in oklch, #2f9e5f 25%, #e6c229) 30%, transparent)');
    expect(valueColor(90)).toBe('color-mix(in srgb, color-mix(in oklch, #2f9e5f 75%, #e6c229) 30%, transparent)');
    expect(valueColor(-15)).toBe('color-mix(in srgb, color-mix(in oklch, #d64545 13%, #e6c229) 30%, transparent)');
    expect(valueColor(200)).toBe('color-mix(in srgb, color-mix(in oklch, #2f9e5f 100%, #e6c229) 30%, transparent)');
  });
  it('formats positional draft rank', () => {
    expect(posLabel('RB', 7)).toBe('RB7');
    expect(posLabel('RB', null)).toBe('RB');
  });
});
