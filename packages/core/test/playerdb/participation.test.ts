import { describe, it, expect } from 'vitest';
import { countRoutes, weekOfGame } from '../../src/playerdb/sources/participation';

const play = (game: string, team: string, pass: boolean, players: string[]) =>
  ({ nflverse_game_id: game, possession_team: team, time_to_throw: pass ? '2.5' : '', offense_players: players.join(';') });

describe('countRoutes', () => {
  it('counts pass plays per team-week and routes per route runner on the field', () => {
    const rows = [
      play('2025_01_TB_CIN', 'TB', true, ['00-A', '00-B', '00-Q']),
      play('2025_01_TB_CIN', 'TB', false, ['00-A', '00-B']),
      play('2025_01_TB_CIN', 'TB', true, ['00-A']),
      play('2025_01_TB_CIN', 'CIN', true, ['00-C']),
      play('2025_19_TB_CIN', 'TB', true, ['00-A']),
    ];
    const p = countRoutes(rows, new Set(['00-A', '00-B', '00-C']));
    expect(p.passPlays.get('TB|1')).toBe(2);
    expect(p.passPlays.get('CIN|1')).toBe(1);
    expect(p.passPlays.has('TB|19')).toBe(false);
    expect(p.routes.get('00-A|1')).toBe(2);
    expect(p.routes.get('00-B|1')).toBe(1);
    expect(p.routes.has('00-Q|1')).toBe(false);
  });
  it('reads the week from the game id', () => {
    expect(weekOfGame('2025_09_ARI_DAL')).toBe(9);
    expect(weekOfGame('2025_18_ARI_DAL')).toBe(18);
  });
});
