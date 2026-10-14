import { describe, it, expect } from 'vitest';
import type { GameSide } from '@fantasy-dash/core';
import { topPerformersBySide } from './metrics';

const side: GameSide = {
  userId: 'a', points: 0, projected: 0, ceiling: 0, efficiency: 1,
  starters: [
    { slot: 'QB', player: { playerId: 'q', points: 12, projected: null, stats: {} } },
    { slot: 'RB', player: null },
    { slot: 'RB', player: { playerId: 'r', points: 30.5, projected: null, stats: {} } },
    { slot: 'WR', player: { playerId: 'w', points: 4, projected: null, stats: {} } },
    { slot: 'TE', player: { playerId: 't', points: 18, projected: null, stats: {} } },
  ],
  bench: [{ playerId: 'b', points: 99, projected: null, stats: {} }],
  optimalSwaps: [], recordBefore: { w: 0, l: 0, t: 0 }, seasonPpg: 0,
};

describe('topPerformersBySide', () => {
  it('returns the side\'s top three starters, highest first, skipping empty slots and the bench', () => {
    expect(topPerformersBySide(side)).toEqual([
      { userId: 'a', playerId: 'r', points: 30.5 },
      { userId: 'a', playerId: 't', points: 18 },
      { userId: 'a', playerId: 'q', points: 12 },
    ]);
  });
  it('honours a custom count', () => {
    expect(topPerformersBySide(side, 1).map((p) => p.playerId)).toEqual(['r']);
    expect(topPerformersBySide({ ...side, starters: [{ slot: 'QB', player: null }] })).toEqual([]);
  });
});
