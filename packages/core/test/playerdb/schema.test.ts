import { describe, it, expect } from 'vitest';
import { PlayerDbSchema } from '../../src/playerdb/schema';
import { PLAYER_WEEK_KEYS, type PlayerDb } from '../../src/playerdb/types';

export const miniDb = (): PlayerDb => ({
  year: 2026, throughWeek: 2, routesReal: false, builtAt: '2026-10-17T00:00:00.000Z',
  players: { '1': { id: '1', gsisId: '00-1', pfrId: 'AbcdA01', name: 'A Back', pos: 'RB', teams: ['SF'], birthDate: '2000-01-01', yearsExp: 2, draft: { year: 2024, round: 1, pick: 9 }, college: 'State', height: 72, weight: 210 } },
  teamWeeks: [{ team: 'SF', week: 1, opp: 'LAR', offSnaps: 60, passAtt: 30, rushAtt: 25, dropbacks: 32, rzLooks: 8, airYds: 250, passPlays: null }],
  xfp: { QB: null, RB: [1, 0.5, 0.01, 1, 0.3, 1.2], WR: null, TE: null },
  rows: [{ id: '1', week: 1, team: 'SF', gp: 1, opp: 'LAR', pts: 12.3, ru_att: 15, ru_yds: 70, re_tgt: 3, snaps: 40, teamSnaps: 60, routesEst: 21 }],
});

describe('PlayerDbSchema', () => {
  it('accepts a well-formed database', () => {
    expect(PlayerDbSchema.parse(miniDb())).toEqual(miniDb());
  });
  it('rejects a row missing its week and a row with an unknown key', () => {
    const noWeek = miniDb();
    delete (noWeek.rows[0] as Partial<typeof noWeek.rows[0]>).week;
    expect(() => PlayerDbSchema.parse(noWeek)).toThrow();
    const junk = miniDb();
    (junk.rows[0] as unknown as Record<string, unknown>).bogus = 1;
    expect(() => PlayerDbSchema.parse(junk)).toThrow(/bogus/);
  });
  it('lists every documented key exactly once', () => {
    expect(new Set(PLAYER_WEEK_KEYS).size).toBe(PLAYER_WEEK_KEYS.length);
    for (const k of ['pts', 'xfp', 'routes', 'routesEst', 'pa_cpoe', 're_sep', 'ru_ryoeAtt', 'fumLost']) expect(PLAYER_WEEK_KEYS).toContain(k);
  });
});
