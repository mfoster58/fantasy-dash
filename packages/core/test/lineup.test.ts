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

  it('uses out: null for an empty starting slot', () => {
    const optimal = optimalLineup(['QB'], [P('qb1', 'QB', 20)]);
    expect(optimalSwaps([null], optimal, (id) => P(id, 'QB', 20))).toEqual([{ out: null, in: 'qb1', gain: 20 }]);
  });
});
