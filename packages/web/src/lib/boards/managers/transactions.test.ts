import { describe, it, expect } from 'vitest';
import type { Transaction, TransactionMove, TransactionType } from '@fantasy-dash/core';
import { flattenLines } from '../../playerLines';
import { players } from '../../../test/playerFixtures';
import { boardsFor } from '../../playerBoards';
import { mctx, seasons } from './shared.test';
import { mtAdds, mtBestPickup, mtBiggestBid, mtBusiest, mtCheap, mtCostly, mtDrops, mtFaabCareer, mtFaabSeason, mtQuickCut, mtTrades } from './transactions';

const DAY = 86_400_000;
const mv = (playerId: string, userId: string): TransactionMove => ({ playerId, userId });
const tx = (id: string, type: TransactionType, week: number, created: number, adds: TransactionMove[], drops: TransactionMove[] = [], bid: number | null = null): Transaction => ({ id, type, week, created, adds, drops, bid });
// fixture lines (shared.test): a starts q1 in 2024 weeks 1-3 (30, 10, 50); b starts r1 (10, 10, 5).
const transactions = [
  { year: 2024, transactions: [
    tx('w1', 'waiver', 2, 10 * DAY, [mv('q1', 'a')], [], 30),            // a claims q1 for $30 before week 2: started weeks 2-3 → 60 pts, 2 starts
    tx('f1', 'free_agent', 1, 0, [mv('r1', 'b')]),                       // b adds r1 as a free agent: started weeks 1-3 → 25 pts
    tx('d1', 'free_agent', 3, 3 * DAY, [], [mv('r1', 'b')]),             // b drops r1 three days later (the week-3 start still counts)
    tx('t1', 'trade', 2, 12 * DAY, [mv('w1', 'a'), mv('t1', 'b')], [mv('t1', 'a'), mv('w1', 'b')]),
  ] },
  { year: 2025, transactions: [tx('f2', 'free_agent', 1, 100 * DAY, [mv('t1', 'b')])] },
];
const ctx = { ...mctx(), transactions, lines: flattenLines(seasons, players) };

describe('manager transaction boards', () => {
  it('counts adds, drops and trades per manager over the scope, the in-progress season included', () => {
    expect(mtAdds(ctx).map((r) => [r.userId, r.value, r.meta])).toEqual([['b', 2, '2 seasons'], ['a', 1, '1 season']]);
    expect(mtDrops(ctx)).toEqual([expect.objectContaining({ userId: 'b', value: 1 })]);
    expect(mtTrades(ctx).map((r) => [r.userId, r.value])).toEqual([['a', 1], ['b', 1]]);
    expect(mtAdds({ ...ctx, year: 2025 }).map((r) => [r.userId, r.value, r.meta])).toEqual([['b', 1, '2025']]);
  });
  it('ranks the busiest manager-seasons under the in-progress rule', () => {
    expect(mtBusiest(ctx).map((r) => [r.userId, r.meta, r.value, r.detail])).toEqual([['b', '2024', 3, '1 add · 1 drop · 1 trade'], ['a', '2024', 2, '1 add · 0 drops · 1 trade']]);
  });
  it('sums FAAB by season and career and finds the biggest bid', () => {
    expect(mtFaabSeason(ctx)).toEqual([expect.objectContaining({ userId: 'a', meta: '2024', value: 30, valueLabel: '$30' })]);
    expect(mtFaabCareer(ctx)).toEqual([expect.objectContaining({ userId: 'a', value: 30, valueLabel: '$30' })]);
    expect(mtBiggestBid(ctx)).toEqual([expect.objectContaining({ userId: 'a', value: 30, valueLabel: '$30', detail: 'Quincy One', meta: '2024 · Wk 2' })]);
  });
  it('prices points per FAAB dollar over claims with at least $25 spent', () => {
    expect(mtCheap(ctx)).toEqual([expect.objectContaining({ userId: 'a', value: 0.5, valueLabel: '$0.50/pt', detail: '$30 · 60.00 pts' })]);
    const pennies = { ...ctx, transactions: [{ year: 2024, transactions: [tx('w3', 'waiver', 2, 10 * DAY, [mv('q1', 'a')], [], 31)] }] };
    expect(mtCheap(pennies)[0]).toMatchObject({ value: 0.52, valueLabel: '$0.52/pt' }); // two decimals, so near-equal rates still rank by value
    expect(mtCostly(ctx)).toHaveLength(1);
    expect(mtCheap({ ...ctx, transactions: [{ year: 2024, transactions: [tx('w2', 'waiver', 2, 10 * DAY, [mv('q1', 'a')], [], 20)] }] })).toEqual([]);
  });
  it('finds the best pickup and the quickest cut', () => {
    expect(mtBestPickup(ctx).slice(0, 2).map((r) => [r.userId, r.value, r.detail])).toEqual([['a', 60, 'Quincy One · $30 · 2 starts'], ['b', 25, 'Ricky One · FA · 3 starts']]); // the 2025 add of t1 trails with 0 points
    expect(mtQuickCut(ctx)).toEqual([expect.objectContaining({ userId: 'b', value: 3, valueLabel: '3.0 days', detail: 'Ricky One', meta: '2024 · Wk 1' })]);
    // trading the player away a day after the add is not a cut; the drop two days later still is
    const traded = { ...ctx, transactions: [{ year: 2024, transactions: [...transactions[0].transactions, tx('t9', 'trade', 1, 1 * DAY, [mv('q1', 'b')], [mv('r1', 'b')])] }] };
    expect(mtQuickCut(traded)[0]).toMatchObject({ userId: 'b', value: 3 });
  });
  it('is registered in order', () => {
    expect(boardsFor('managers', 'mtransactions').map((b) => b.id)).toEqual(['mtAdds', 'mtDrops', 'mtTrades', 'mtBusiest', 'mtFaabSeason', 'mtFaabCareer', 'mtBiggestBid', 'mtCheap', 'mtCostly', 'mtBestPickup', 'mtQuickCut']);
  });
});
