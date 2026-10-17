import { describe, it, expect } from 'vitest';
import { playerSeasonsOf, trimPlayerSeasons } from '../src/playerSeasons';
import { buildSeason } from '../src/season';
import { SeasonSchema } from '../src/schema';
import { miniInput } from './fixtures/mini';
import type { PlayerDirectory } from '../src/types';

const dir: PlayerDirectory = {
  a: { id: 'a', name: 'A', firstName: 'A', lastName: '', position: 'WR', team: 'KC', yearsExp: 1, birthDate: null },
  b: { id: 'b', name: 'B', firstName: 'B', lastName: '', position: 'WR', team: 'KC', yearsExp: 1, birthDate: null },
  c: { id: 'c', name: 'C', firstName: 'C', lastName: '', position: 'WR', team: 'KC', yearsExp: 1, birthDate: null },
  q: { id: 'q', name: 'Q', firstName: 'Q', lastName: '', position: 'QB', team: 'KC', yearsExp: 1, birthDate: null },
  u: { id: 'u', name: 'U', firstName: 'U', lastName: '', position: null, team: null, yearsExp: null, birthDate: null },
};

describe('playerSeasonsOf', () => {
  it('ranks within position by points, ties by id, and skips players with no games', () => {
    const out = playerSeasonsOf({ a: 50, b: 80, c: 50, q: 300, u: 10, z: 99 }, { a: 10, b: 12, c: 9, q: 17, u: 3 }, dir);
    expect(out).toEqual({
      a: { points: 50, games: 10, posRank: 2 },
      b: { points: 80, games: 12, posRank: 1 },
      c: { points: 50, games: 9, posRank: 3 },
      q: { points: 300, games: 17, posRank: 1 },
      u: { points: 10, games: 3, posRank: null },
    });
  });
  it('keeps a player with games but zero points', () => {
    expect(playerSeasonsOf({}, { a: 2 }, dir)).toEqual({ a: { points: 0, games: 2, posRank: 1 } });
  });
});

describe('season playerSeasons', () => {
  it('are built from the raw input, validate, and trim to a kept set', () => {
    const input = miniInput();
    input.playerGames = { q1: 3, q3: 3 };
    input.playerTeams = { q1: 'KC', q3: 'DET', r1: 'SF' };
    const season = buildSeason(input);
    expect(season.playerTeams).toEqual({ q1: 'KC', q3: 'DET', r1: 'SF' });
    expect(season.playerSeasons.q3).toEqual({ points: 90, games: 3, posRank: 1 });
    expect(season.playerSeasons.q1).toEqual({ points: 80, games: 3, posRank: 2 });
    expect(season.playerSeasons.r1).toBeUndefined(); // no games recorded
    expect(() => SeasonSchema.parse(season)).not.toThrow();
    const trimmed = trimPlayerSeasons(season, new Set(['q1']));
    expect(trimmed.playerTeams).toEqual({ q1: 'KC' });
    expect(Object.keys(trimmed.playerSeasons)).toEqual(['q1']);
    expect(trimmed.playerSeasons.q1.posRank).toBe(2); // rank was computed before the trim
  });
});
