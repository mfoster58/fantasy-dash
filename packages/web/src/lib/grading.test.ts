import { describe, it, expect } from 'vitest';
import type { Draft, DraftPick } from '@fantasy-dash/core';
import { gradeTotals, gradingExamples } from './grading';

const pick = (pickNo: number, userId: string, contribution: number, earnedPick: number | null, value: number): DraftPick => ({
  round: Math.ceil(pickNo / 2), pickNo, slot: ((pickNo - 1) % 2) + 1, userId, playerId: `p${pickNo}`, isKeeper: false,
  posDraftRank: 1, seasonPoints: 100, gamesPlayed: 5, ppg: 20, healthy: true,
  pointsOverBaseline: contribution, redraftPos: 1, contribution, earnedPick, value, tradedTo: null,
});
const draft: Draft = {
  draftId: 'D', type: 'snake', rounds: 15, slotOrder: ['a', 'b'], expectedCurve: { a: 40, k: 36, c: -5 }, baselines: {},
  picks: [
    pick(1, 'a', 90, -10, 30),        // dominant
    pick(2, 'b', -20, null, -98),     // bust
    pick(51, 'a', 40, 3, 70),         // steal after 50
    pick(19, 'b', 30, 8, 20),         // late by teams*9 = 18
    pick(23, 'a', -10, null, -4),     // late miss (> 22, off the board)
    pick(24, 'b', -10, null, -3),
    pick(25, 'a', -10, 60, 0),
  ],
};

describe('gradingExamples', () => {
  it('picks one illustrative pick per role without repeats', () => {
    const ex = gradingExamples(draft);
    expect(ex.map((e) => [e.key, e.pick.pickNo])).toEqual([['dominant', 1], ['steal', 51], ['bust', 2], ['lateHit', 19], ['lateMiss', 23]]);
  });
  it('skips roles with no qualifying pick', () => {
    const ex = gradingExamples({ ...draft, picks: draft.picks.slice(0, 2) });
    expect(ex.map((e) => e.key)).toEqual(['dominant', 'bust']);
  });
});

describe('gradeTotals', () => {
  it('sums values per manager, best first', () => {
    expect(gradeTotals(draft)).toEqual([['a', 96], ['b', -81]]);
  });
});
