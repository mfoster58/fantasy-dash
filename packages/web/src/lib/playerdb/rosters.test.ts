import type { Transaction } from '@fantasy-dash/core';
import { rosterMap } from './rosters';
import { game, line, season, side, week } from '../../test/playerFixtures';

const tx = (id: string, type: Transaction['type'], wk: number, created: number, adds: [string, string][], drops: [string, string][]): Transaction =>
  ({ id, type, week: wk, created, adds: adds.map(([playerId, userId]) => ({ playerId, userId })), drops: drops.map(([playerId, userId]) => ({ playerId, userId })), bid: null });

describe('rosterMap', () => {
  it('starts from the last played week\'s lineups, bench included, then applies later transactions in order', () => {
    const s = season(2026, [
      week(1, [game(2026, 1, 1, side('A', 100, [line('w1', 10)], [line('r1', 5)]), side('B', 90, [line('q1', 20)]))]),
      week(2, [game(2026, 2, 1, side('A', 100, [line('w1', 10)], [line('r1', 5)]), side('B', 90, [line('q1', 20)], [line('t1', 3)]))]),
      week(3, []),
    ], null, 2);
    s.transactions = [
      tx('1', 'waiver', 2, 100, [['w9', 'A']], [['r1', 'A']]),          // week 2: already reflected in the lineups, ignored
      tx('3', 'free_agent', 3, 300, [['t1', 'A']], [['t1', 'B']]),      // later: B drops t1, A adds him
      tx('2', 'waiver', 3, 200, [['r2', 'B']], [['q1', 'B']]),          // earlier created: applied first
    ];
    expect(rosterMap(s)).toEqual({ w1: 'A', r1: 'A', t1: 'A', r2: 'B' });
  });
  it('is empty before any week is played, apart from transactions', () => {
    const s = season(2026, [week(1, [])], null, 0);
    s.transactions = [tx('1', 'free_agent', 1, 1, [['w1', 'A']], [])];
    expect(rosterMap(s)).toEqual({ w1: 'A' });
  });
});
