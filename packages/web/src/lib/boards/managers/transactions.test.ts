import { describe, it, expect } from 'vitest';
import type { Transaction, TransactionMove, TransactionType } from '@fantasy-dash/core';
import { flattenLines } from '../../playerLines';
import { players } from '../../../test/playerFixtures';
import { boardsFor } from '../../playerBoards';
import { mctx, seasons } from './shared.test';
import { mtAdds, mtBestPickup, mtBestStart, mtBiggestBid, mtBusiest, mtDrops, mtFaabCareer, mtFaabValue, mtFaabWasted, mtTrades, mtWaiverPoints, mtWaiverStarts } from './transactions';

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
  it('sums FAAB over the career and finds the biggest bid, naming its player', () => {
    expect(mtFaabCareer(ctx)).toEqual([expect.objectContaining({ userId: 'a', value: 30, valueLabel: '$30' })]);
    expect(mtBiggestBid(ctx)).toEqual([expect.objectContaining({ userId: 'a', player: 'q1', value: 30, valueLabel: '$30', detail: null, meta: '2024 · Wk 2' })]);
    expect(mtBiggestBid({ ...ctx, pos: 'RB' })).toEqual([]);
  });
  it('sums the FAAB a manager bid on flops, claims that returned under 10 started points once their stint was over', () => {
    // a also claims w1 for $20 before week 2 and never starts him; the season is complete, so that bid is a flop
    const flops = { ...ctx, transactions: [{ year: 2024, transactions: [...transactions[0].transactions, tx('w9', 'waiver', 2, 11 * DAY, [mv('w1', 'a')], [], 20)] }] };
    expect(mtFaabWasted(flops)).toEqual([expect.objectContaining({ userId: 'a', value: 20, valueLabel: '$20', detail: 'of $50 judged · 1 flop', meta: '1 season' })]);
    expect(mtFaabWasted(ctx)).toEqual([]); // q1 returned 60: no flops
    // an open claim in a season still in progress is not judged yet
    const open = { ...flops, transactions: flops.transactions.map((s) => ({ ...s, complete: false })) };
    expect(mtFaabWasted(open)).toEqual([]);
  });
  it('rates FAAB value as the share of judged dollars that went on claims returning 10+ points, at least $25 judged', () => {
    const flops = { ...ctx, transactions: [{ year: 2024, transactions: [...transactions[0].transactions, tx('w9', 'waiver', 2, 11 * DAY, [mv('w1', 'a')], [], 20)] }] };
    expect(mtFaabValue(flops)).toEqual([expect.objectContaining({ userId: 'a', value: 60, valueLabel: '60%', detail: '$30 of $50 · 1 of 2 claims hit' })]);
    expect(mtFaabValue(ctx)).toEqual([expect.objectContaining({ userId: 'a', value: 100, valueLabel: '100%', detail: '$30 of $30 · 1 of 1 claims hit' })]);
    const open = { ...flops, transactions: flops.transactions.map((s) => ({ ...s, complete: false })) };
    expect(mtFaabValue(open)).toEqual([expect.objectContaining({ userId: 'a', value: 100, detail: '$30 of $30 · 1 of 1 claims hit' })]); // q1 already hit; the open $20 claim is not judged yet
    expect(mtFaabValue({ ...ctx, transactions: [{ year: 2024, transactions: [tx('w2', 'waiver', 2, 10 * DAY, [mv('q1', 'a')], [], 20)] }] })).toEqual([]); // under $25
  });
  it('finds the best pickup, naming its player, and narrows by that player\'s position', () => {
    expect(mtBestPickup(ctx).slice(0, 2).map((r) => [r.userId, r.player, r.value, r.detail])).toEqual([['a', 'q1', 60, '$30 · 2 starts'], ['b', 'r1', 25, 'FA · 3 starts']]); // the 2025 add of t1 trails with 0 points
    expect(mtBestPickup({ ...ctx, pos: 'RB' }).map((r) => r.player)).toEqual(['r1']);
  });
  it('finds the best single start by a pickup while on the claimer\'s roster, linking to the box score', () => {
    // a's q1: started weeks 2 (10) and 3 (50, the Final); b's r1: 10, 10, 5 (the newer 10 wins the tie)
    const rows = mtBestStart(ctx);
    expect(rows[0]).toMatchObject({ userId: 'a', player: 'q1', value: 50, meta: '2024 · Wk 3 · Championship', detail: '$30', to: '/scores/2024/3/1' });
    expect(rows.find((r) => r.userId === 'b')).toMatchObject({ player: 'r1', value: 10, meta: '2024 · Wk 2', detail: 'FA', to: '/scores/2024/2/1' });
    expect(rows).toHaveLength(5);
    expect(mtBestStart({ ...ctx, pos: 'QB' }).map((r) => r.player)).toEqual(['q1', 'q1']); // one row per start
  });
  it('totals pickup starts and pickup points per manager', () => {
    expect(mtWaiverStarts(ctx).map((r) => [r.userId, r.value, r.detail])).toEqual([['b', 3, '25.00 pts'], ['a', 2, '60.00 pts']]);
    expect(mtWaiverPoints(ctx).map((r) => [r.userId, r.value, r.valueLabel, r.detail])).toEqual([['a', 60, '60.00', '2 starts'], ['b', 25, '25.00', '3 starts']]);
    expect(mtWaiverPoints({ ...ctx, ...mctx(2025), transactions })).toEqual([]); // t1 never scored for b
  });
  it('is registered in order, the player boards offering a position dropdown', () => {
    expect(boardsFor('managers', 'mtransactions').map((b) => b.id)).toEqual(['mtAdds', 'mtDrops', 'mtTrades', 'mtBusiest', 'mtFaabCareer', 'mtBiggestBid', 'mtFaabValue', 'mtFaabWasted', 'mtBestPickup', 'mtBestStart', 'mtWaiverStarts', 'mtWaiverPoints']);
    expect(boardsFor('managers', 'mtransactions').filter((b) => b.positions).map((b) => b.id)).toEqual(['mtBiggestBid', 'mtBestPickup', 'mtBestStart']);
  });
});
