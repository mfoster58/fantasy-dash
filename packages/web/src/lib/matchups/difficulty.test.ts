import type { PlayerDb } from '@fantasy-dash/core';
import { defenseRanks } from './difficulty';

// six defenses, WRs scoring more against each in turn: A allows the least, F the most
const teams = ['A', 'B', 'C', 'D', 'E', 'F'];
const db = {
  players: { w1: { id: 'w1', pos: 'WR' }, w2: { id: 'w2', pos: 'WR' }, q1: { id: 'q1', pos: 'QB' } },
  rows: teams.flatMap((opp, i) => [1, 2].flatMap((week) => [
    { id: 'w1', week, team: 'X', gp: 1, opp, pts: 5 + i * 3 },
    { id: 'w2', week, team: 'X', gp: 1, opp, pts: 2 },
    { id: 'q1', week, team: 'X', gp: 1, opp, pts: 30 - i },
  ])),
} as unknown as PlayerDb;

describe('defenseRanks', () => {
  it('ranks each defense by points per game allowed to a position: the most allowed is the easiest matchup', () => {
    const rank = defenseRanks(db, 2);
    expect(rank('F', 'WR')).toEqual({ rank: 1, of: 6, tone: 'easy', perGame: 22 });
    expect(rank('A', 'WR')).toMatchObject({ rank: 6, tone: 'hard' });
    expect(rank('C', 'WR')).toMatchObject({ rank: 4, tone: 'mid' });
    // QBs see it the other way round
    expect(rank('A', 'QB')).toMatchObject({ rank: 1, tone: 'easy' });
  });
  it('has nothing to say about a team or position without rows', () => {
    const rank = defenseRanks(db, 2);
    expect(rank('Z', 'WR')).toBeNull();
    expect(rank('A', 'TE')).toBeNull();
  });
});
