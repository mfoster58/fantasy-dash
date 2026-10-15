import { describe, it, expect } from 'vitest';
import { transactionsOf } from '../src/transactions';
import { buildSeason } from '../src/season';
import { SeasonSchema } from '../src/schema';
import { miniInput } from './fixtures/mini';
import type { SleeperTransaction } from '../src/sleeper/types';

const tx = (over: Partial<SleeperTransaction>): SleeperTransaction => ({
  transaction_id: 't', type: 'trade', status: 'complete', leg: 3, created: 100, adds: null, drops: null, roster_ids: [], settings: null, ...over,
});
const users = { 1: 'ua', 2: 'ub' };

describe('transactionsOf', () => {
  it('keeps completed transactions, resolves rosters, carries the FAAB bid, sorts by time', () => {
    const out = transactionsOf([
      tx({ transaction_id: 'w1', type: 'waiver', leg: 4, created: 400, adds: { p3: 1 }, drops: { p9: 1 }, settings: { waiver_bid: 12, seq: 1 } }),
      tx({ transaction_id: 't1', adds: { p1: 2, p2: 1 }, drops: { p1: 1, p2: 2 }, roster_ids: [1, 2] }),
      tx({ transaction_id: 'f1', type: 'free_agent', leg: 5, created: 500, adds: { p4: 2 } }),
      tx({ transaction_id: 'c1', type: 'commissioner', leg: 5, created: 500, drops: { p5: 1 } }),
      tx({ transaction_id: 'x1', type: 'weird', leg: 6, created: 600, adds: { p6: 1 } }),
    ], users);
    expect(out).toEqual([
      { id: 't1', type: 'trade', week: 3, created: 100, adds: [{ playerId: 'p1', userId: 'ub' }, { playerId: 'p2', userId: 'ua' }], drops: [{ playerId: 'p1', userId: 'ua' }, { playerId: 'p2', userId: 'ub' }], bid: null },
      { id: 'w1', type: 'waiver', week: 4, created: 400, adds: [{ playerId: 'p3', userId: 'ua' }], drops: [{ playerId: 'p9', userId: 'ua' }], bid: 12 },
      { id: 'c1', type: 'commissioner', week: 5, created: 500, adds: [], drops: [{ playerId: 'p5', userId: 'ua' }], bid: null },
      { id: 'f1', type: 'free_agent', week: 5, created: 500, adds: [{ playerId: 'p4', userId: 'ub' }], drops: [], bid: null },
      { id: 'x1', type: 'commissioner', week: 6, created: 600, adds: [{ playerId: 'p6', userId: 'ua' }], drops: [], bid: null },
    ]);
  });
  it('drops failed transactions, unknown rosters, and transactions left empty', () => {
    const out = transactionsOf([
      tx({ transaction_id: 'bad', status: 'failed', adds: { p1: 1 } }),
      tx({ transaction_id: 'ghost', type: 'waiver', adds: { p2: 9 }, settings: { waiver_bid: 3 } }),
      tx({ transaction_id: 'half', adds: { p3: 9, p4: 1 } }),
    ], users);
    expect(out).toEqual([{ id: 'half', type: 'trade', week: 3, created: 100, adds: [{ playerId: 'p4', userId: 'ua' }], drops: [], bid: null }]);
  });
  it('treats a waiver with no bid as bid 0', () => {
    expect(transactionsOf([tx({ type: 'waiver', adds: { p1: 1 } })], users)[0].bid).toBe(0);
  });
});

describe('season transactions', () => {
  it('are built from the raw input and validate', () => {
    const input = miniInput();
    input.transactions = [tx({ transaction_id: 'w', type: 'waiver', leg: 2, created: 5, adds: { q1: 1 }, drops: { q4: 1 }, settings: { waiver_bid: 7 } })];
    const season = buildSeason(input);
    expect(season.transactions).toEqual([{ id: 'w', type: 'waiver', week: 2, created: 5, adds: [{ playerId: 'q1', userId: 'ua' }], drops: [{ playerId: 'q4', userId: 'ua' }], bid: 7 }]);
    expect(() => SeasonSchema.parse(season)).not.toThrow();
    expect(() => SeasonSchema.parse({ ...season, transactions: [{ id: 1 }] })).toThrow();
  });
});
