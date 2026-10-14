import { describe, it, expect } from 'vitest';
import { optimalLineup, optimalSwaps, type LineupPlayer } from '../src/lineup';

const P = (playerId: string, position: string | null, points: number): LineupPlayer => ({ playerId, position, points });

const players: LineupPlayer[] = [
  P('qb1', 'QB', 20), P('qb2', 'QB', 25),
  P('rb1', 'RB', 10), P('rb2', 'RB', 8), P('rb3', 'RB', 12),
  P('wr1', 'WR', 11), P('te1', 'TE', 5),
];
const slots = ['QB', 'RB', 'RB', 'FLEX'];

describe('optimalLineup', () => {
  it('fills fixed slots with the best at each position, then FLEX from RB/WR/TE', () => {
    const lineup = optimalLineup(slots, players);
    expect(lineup.slots).toEqual([
      { slot: 'QB', playerId: 'qb2' },
      { slot: 'RB', playerId: 'rb3' },
      { slot: 'RB', playerId: 'rb1' },
      { slot: 'FLEX', playerId: 'wr1' },
    ]);
    expect(lineup.total).toBe(58);
  });

  it('leaves a slot empty when no eligible player exists', () => {
    const lineup = optimalLineup(['QB', 'K'], [P('qb1', 'QB', 9)]);
    expect(lineup.slots[1]).toEqual({ slot: 'K', playerId: null });
    expect(lineup.total).toBe(9);
  });

  it('ignores players with unknown position', () => {
    const lineup = optimalLineup(['RB'], [P('x', null, 99), P('rb1', 'RB', 3)]);
    expect(lineup.slots[0].playerId).toBe('rb1');
  });
});

describe('optimalSwaps', () => {
  const byId = new Map(players.map((p) => [p.playerId, p]));
  const info = (id: string) => byId.get(id)!;

  it('pairs each optimal addition with a benched starter of the same position when possible', () => {
    const optimal = optimalLineup(slots, players);
    const swaps = optimalSwaps(['qb1', 'rb1', 'rb2', 'te1'], optimal, info);
    expect(swaps).toEqual([
      { out: 'qb1', in: 'qb2', gain: 5 },
      { out: 'rb2', in: 'rb3', gain: 4 },
      { out: 'te1', in: 'wr1', gain: 6 },
    ]);
    const actualTotal = 20 + 10 + 8 + 5;
    expect(swaps.reduce((s, x) => s + x.gain, 0)).toBe(optimal.total - actualTotal);
  });

  it('returns no swaps when the lineup was already optimal', () => {
    const optimal = optimalLineup(slots, players);
    expect(optimalSwaps(['qb2', 'rb3', 'rb1', 'wr1'], optimal, info)).toEqual([]);
  });

  it('pairs same-position swaps first so a flex mismatch never steals a needed starter', () => {
    const roster: LineupPlayer[] = [
      P('qb', 'QB', 18),
      P('rbA', 'RB', 10), P('rbB', 'RB', 14),
      P('wrA', 'WR', 15), P('wrB', 'WR', 9),
      P('defA', 'DEF', 2), P('defB', 'DEF', 6),
    ];
    const lookup = new Map(roster.map((p) => [p.playerId, p]));
    const optimal = optimalLineup(['QB', 'RB', 'WR', 'FLEX', 'DEF'], roster);
    const swaps = optimalSwaps(['qb', 'rbA', 'wrA', 'wrB', 'defA'], optimal, (id) => lookup.get(id)!);
    expect(swaps).toEqual([
      { out: 'wrB', in: 'rbB', gain: 5 },
      { out: 'defA', in: 'defB', gain: 4 },
    ]);
    expect(swaps.every((s) => s.gain >= 0)).toBe(true);
    const actualTotal = 18 + 10 + 15 + 9 + 2;
    expect(swaps.reduce((s, x) => s + x.gain, 0)).toBe(optimal.total - actualTotal);
  });

  it('uses out: null for an empty starting slot', () => {
    const optimal = optimalLineup(['QB'], [P('qb1', 'QB', 20)]);
    expect(optimalSwaps([null], optimal, (id) => P(id, 'QB', 20))).toEqual([{ out: null, in: 'qb1', gain: 20 }]);
  });
});
