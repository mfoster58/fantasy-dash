import { describe, it, expect } from 'vitest';
import type { Transaction } from '@fantasy-dash/core';
import { flattenLines } from './playerLines';
import { waiverClaims } from './waivers';
import { game, line, players, season, side, week } from '../test/playerFixtures';

const t = (over: Partial<Transaction>): Transaction => ({ id: 'x', type: 'waiver', week: 1, created: 1, adds: [], drops: [], bid: 5, ...over });
const s = season(2025, [
  week(1, [game(2025, 1, 1, side('a', 10, [line('q1', 10)]), side('b', 1, [line('r1', 1)]))]),
  week(2, [game(2025, 2, 1, side('a', 20, [line('w1', 20)], [line('q1', 7)]), side('b', 1, [line('r1', 1)]))]),
  week(3, [game(2025, 3, 1, side('a', 15, [line('w1', 15)]), side('b', 9, [line('r1', 9)]))]),
  week(4, [game(2025, 4, 1, side('b', 30, [line('w1', 30)]), side('a', 2, [line('q1', 2)]))]),
]);
const lines = flattenLines([s], players);
const bare = (cs: ReturnType<typeof waiverClaims>) => cs.map(({ lines: _lines, open: _open, ...c }) => c);

describe('waiverClaims', () => {
  it('marks a claim open while its player is still on the roster in a season that is not complete', () => {
    const txs = [
      t({ id: 'c1', week: 2, created: 2, adds: [{ playerId: 'w1', userId: 'a' }], bid: 12 }),
      t({ id: 'c2', week: 1, created: 1, adds: [{ playerId: 'r1', userId: 'b' }], bid: 4 }),
      t({ id: 'd2', week: 3, created: 3, type: 'free_agent', drops: [{ playerId: 'r1', userId: 'b' }], bid: null }),
    ];
    expect(waiverClaims([{ year: 2025, complete: false, transactions: txs }], lines).map((c) => [c.playerId, c.open])).toEqual([['r1', false], ['w1', true]]);
    expect(waiverClaims([{ year: 2025, complete: true, transactions: txs }], lines).map((c) => c.open)).toEqual([false, false]);
    expect(waiverClaims([{ year: 2025, transactions: txs }], lines).map((c) => c.open)).toEqual([false, false]); // unsaid: a complete season
  });
  it('sums started points for the claimer from the claim week through the week that manager drops the player', () => {
    // a drops w1 in week 3 (Sleeper keeps leg at 3 until the Tuesday after week 3), so a's week-3 start still counts
    const claims = waiverClaims([{ year: 2025, transactions: [
      t({ id: 'c1', week: 2, created: 2, adds: [{ playerId: 'w1', userId: 'a' }], bid: 12 }),
      t({ id: 'd1', week: 3, created: 4, type: 'free_agent', adds: [{ playerId: 'w1', userId: 'b' }], drops: [{ playerId: 'w1', userId: 'a' }], bid: null }),
    ] }], lines);
    expect(bare(claims)).toEqual([
      { year: 2025, week: 2, playerId: 'w1', userId: 'a', bid: 12, points: 35, starts: 2 },
      { year: 2025, week: 3, playerId: 'w1', userId: 'b', bid: null, points: 30, starts: 1 }, // b's free-agent add runs to season end
    ]);
    // the started lines inside the window travel with the claim
    expect(claims[0].lines.map((l) => [l.week, l.points])).toEqual([[2, 20], [3, 15]]);
  });
  it('never hands the same start to two claims by the same manager: a re-add starts after the earlier window ends', () => {
    // a adds w1 before week 2, drops him in week 3 (that start is still a's first claim) and re-adds him the same week
    const claims = waiverClaims([{ year: 2025, transactions: [
      t({ id: 'c1', week: 2, created: 2, type: 'free_agent', adds: [{ playerId: 'w1', userId: 'a' }], bid: null }),
      t({ id: 'd1', week: 3, created: 4, type: 'free_agent', drops: [{ playerId: 'w1', userId: 'a' }], bid: null }),
      t({ id: 'c2', week: 3, created: 5, adds: [{ playerId: 'w1', userId: 'a' }], bid: 3 }),
    ] }], lines);
    expect(bare(claims)).toEqual([
      { year: 2025, week: 2, playerId: 'w1', userId: 'a', bid: null, points: 35, starts: 2 },
      { year: 2025, week: 3, playerId: 'w1', userId: 'a', bid: 3, points: 0, starts: 0 }, // week 4 is b's roster
    ]);
  });

  it('drops a claim whose window holds no scored week', () => {
    // week 5 is not scored in the fixture (claims processed after the last scored week)
    const claims = waiverClaims([{ year: 2025, transactions: [t({ id: 'c9', week: 5, created: 9, adds: [{ playerId: 'q1', userId: 'a' }], bid: 40 })] }], lines);
    expect(bare(claims)).toEqual([]);
  });
  it('runs to season end without a drop, counts free-agent adds with no bid, and keeps a claim benched then dropped the same week at zero starts', () => {
    const claims = waiverClaims([{ year: 2025, transactions: [
      t({ id: 'c1', week: 3, created: 3, adds: [{ playerId: 'r1', userId: 'b' }], bid: 1 }),
      t({ id: 'c2', week: 2, created: 2, adds: [{ playerId: 'q1', userId: 'a' }], bid: 40 }),
      t({ id: 'd2', week: 2, created: 3, type: 'commissioner', drops: [{ playerId: 'q1', userId: 'a' }], bid: null }),
      t({ id: 'f1', week: 1, created: 0, type: 'free_agent', adds: [{ playerId: 'q1', userId: 'a' }], bid: null }),
      t({ id: 'x1', week: 1, created: 1, type: 'trade', adds: [{ playerId: 'w1', userId: 'a' }], bid: null }),
    ] }], lines);
    // the free-agent add of q1 runs until the commissioner drop in week 2: a started q1 in week 1 only; trades never count
    expect(bare(claims)).toEqual([
      { year: 2025, week: 1, playerId: 'q1', userId: 'a', bid: null, points: 10, starts: 1 },
      { year: 2025, week: 2, playerId: 'q1', userId: 'a', bid: 40, points: 0, starts: 0 },
      { year: 2025, week: 3, playerId: 'r1', userId: 'b', bid: 1, points: 9, starts: 1 },
    ]);
  });
});
