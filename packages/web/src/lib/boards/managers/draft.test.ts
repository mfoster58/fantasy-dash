import { describe, it, expect } from 'vitest';
import type { Draft, DraftPick } from '@fantasy-dash/core';
import { BOARDS, boardsFor } from '../../playerBoards';
import { mctx } from './shared.test';
import { mdBestClass, mdBust, mdFirstRound, mdLate, mdSteal, mdWorstClass } from './draft';

const pick = (round: number, pickNo: number, userId: string, playerId: string, value: number | null): DraftPick =>
  ({ round, pickNo, slot: pickNo, userId, playerId, isKeeper: false, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: false, pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value, tradedTo: null });
const draftOf = (picks: DraftPick[]): Draft => ({ draftId: 'D', type: 'snake', rounds: 10, slotOrder: ['a', 'b'], picks, expectedCurve: null, baselines: {} });
const drafts = {
  2023: draftOf([pick(1, 1, 'a', 't1', 10)]),
  2024: draftOf([pick(1, 1, 'a', 'q1', 20), pick(1, 2, 'b', 'r1', -15), pick(9, 81, 'a', 'w1', 30), pick(9, 82, 'b', 't1', 5), pick(10, 91, 'b', 'k1', null)]),
  2025: draftOf([pick(1, 1, 'b', 'q1', 40)]),
};
// 2023 is a complete season for a (a copy of the 2024 row); 2024 complete; 2025 in progress
const base = mctx();
const ctx = { ...base, drafts, managerSeasons: [...base.managerSeasons, { ...base.managerSeasons[0], year: 2023 }] };

describe('manager draft boards', () => {
  it('sums a manager\'s pick values per complete season under All-time and the chosen year otherwise', () => {
    expect(mdBestClass(ctx).map((r) => [r.userId, r.meta, r.value, r.valueLabel, r.detail, r.to, r.tone])).toEqual([
      ['a', '2024', 50, '+50.0', '2 picks', '/draft/2024', 'win'], ['a', '2023', 10, '+10.0', '1 pick', '/draft/2023', 'win'], ['b', '2024', -10, '-10.0', '2 picks', '/draft/2024', 'loss'],
    ]);
    expect(mdWorstClass(ctx)[0]).toMatchObject({ userId: 'b', value: -10 });
    expect(mdBestClass({ ...mctx(2025), drafts }).map((r) => [r.userId, r.value])).toEqual([['b', 40]]);
  });
  it('finds the single best and worst picks with the player and slot', () => {
    expect(mdSteal(ctx)[0]).toMatchObject({ userId: 'a', value: 30, detail: 'Wally One · Rd 9, pick 81', meta: '2024', to: '/draft/2024' });
    expect(mdBust(ctx)[0]).toMatchObject({ userId: 'b', value: -15, detail: 'Ricky One · Rd 1, pick 2' });
  });
  it('sums late-round value from round 9 on', () => {
    expect(mdLate(ctx).map((r) => [r.userId, r.value])).toEqual([['a', 30], ['b', 5]]);
  });
  it('averages first-round value over at least two complete seasons', () => {
    expect(mdFirstRound(ctx)).toEqual([expect.objectContaining({ userId: 'a', value: 15, valueLabel: '+15.0', meta: '2023–2024 · 2 seasons', detail: '2 first-round picks' })]);
    expect(mdFirstRound(base)).toEqual([]);
    expect(BOARDS.find((b) => b.id === 'mdFirstRound')!.empty!(base)).toMatch(/two complete seasons/);
  });
  it('is registered in order', () => {
    expect(boardsFor('managers', 'mdraft').map((b) => b.id)).toEqual(['mdBestClass', 'mdWorstClass', 'mdSteal', 'mdBust', 'mdLate', 'mdFirstRound']);
  });
});
