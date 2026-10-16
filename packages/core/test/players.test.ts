import { describe, it, expect } from 'vitest';
import { toPlayerDirectory, trimPlayers, collectPlayerIds, weekTeams } from '../src/players';
import type { Season } from '../src/types';

describe('toPlayerDirectory', () => {
  it('normalizes players and team defenses', () => {
    const dir = toPlayerDirectory({
      '4034': { player_id: '4034', full_name: 'Christian McCaffrey', first_name: 'Christian', last_name: 'McCaffrey', position: 'RB', team: 'SF', years_exp: 7 },
      'SF': { player_id: 'SF', first_name: 'San Francisco', last_name: '49ers', position: 'DEF', team: 'SF' },
      '999': { player_id: '999', first_name: 'No', last_name: 'Position' },
    });
    expect(dir['4034']).toEqual({ id: '4034', name: 'Christian McCaffrey', firstName: 'Christian', lastName: 'McCaffrey', position: 'RB', team: 'SF', yearsExp: 7 });
    expect(dir['SF']).toEqual({ id: 'SF', name: 'San Francisco 49ers', firstName: 'San Francisco', lastName: '49ers', position: 'DEF', team: 'SF', yearsExp: null });
    expect(dir['999'].position).toBeNull();
    expect(dir['999'].name).toBe('No Position');
  });
});

describe('trimPlayers', () => {
  it('keeps only requested ids', () => {
    const dir = toPlayerDirectory({ a: { player_id: 'a', full_name: 'A' }, b: { player_id: 'b', full_name: 'B' } });
    expect(Object.keys(trimPlayers(dir, new Set(['b', 'zzz'])))).toEqual(['b']);
  });
});

describe('weekTeams', () => {
  it('maps each row to the team it lists, skipping rows without one', () => {
    expect(weekTeams([
      { player_id: '4866', team: 'NYG', stats: { gp: 1 } },
      { player_id: 'PHI', team: 'PHI' },
      { player_id: '999', team: null },
    ])).toEqual({ '4866': 'NYG', PHI: 'PHI' });
  });
});

describe('collectPlayerIds', () => {
  it('includes draft picks', () => {
    const season = { weeks: [], draft: { picks: [{ playerId: 'd1' }, { playerId: 'd2' }] } } as unknown as Season;
    expect([...collectPlayerIds([season])].sort()).toEqual(['d1', 'd2']);
  });

  it('includes players who only ever appear in transactions', () => {
    const season = { weeks: [], draft: null, transactions: [{ adds: [{ playerId: 't1', userId: 'u' }], drops: [{ playerId: 't2', userId: 'u' }] }] } as unknown as Season;
    expect([...collectPlayerIds([season])].sort()).toEqual(['t1', 't2']);
  });

  it('gathers starters, bench and swap ids across seasons', () => {
    const season = {
      weeks: [{
        games: [{
          sides: [
            { starters: [{ slot: 'QB', player: { playerId: 'q1' } }, { slot: 'RB', player: null }], bench: [{ playerId: 'b1' }], optimalSwaps: [{ in: 'b1', out: 'q1' }] },
            { starters: [], bench: [{ playerId: 'b2' }], optimalSwaps: [] },
          ],
        }],
      }],
    } as unknown as Season;
    expect([...collectPlayerIds([season])].sort()).toEqual(['b1', 'b2', 'q1']);
  });
});
