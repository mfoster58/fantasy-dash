import type { DbPlayer, PlayerDb, PlayerWeek, TeamWeek } from '@fantasy-dash/core';

export const player = (id: string, pos: DbPlayer['pos'], teams: string[], name = id.toUpperCase()): DbPlayer =>
  ({ id, gsisId: `00-${id}`, pfrId: null, name, pos, teams, birthDate: null, yearsExp: 2, draft: null, college: null, height: null, weight: null });

export const row = (id: string, week: number, team: string, extra: Partial<PlayerWeek> = {}): PlayerWeek => ({ id, week, team, gp: 1, opp: 'OPP', ...extra });

export const teamWeek = (team: string, week: number, extra: Partial<TeamWeek> = {}): TeamWeek =>
  ({ team, week, opp: 'OPP', offSnaps: 60, passAtt: 30, rushAtt: 20, dropbacks: 32, rzLooks: 8, airYds: 240, passPlays: null, ...extra });

/** Five players over three weeks. w1 is traded from TB to KC for week 3; w2 misses week 3; w1 has NGS separation in weeks 1–2 only. */
export function miniDb(): PlayerDb {
  return {
    year: 2026, throughWeek: 3, routesReal: false, builtAt: '2026-10-17T00:00:00.000Z',
    players: { w1: player('w1', 'WR', ['TB', 'KC'], 'Wide One'), w2: player('w2', 'WR', ['TB'], 'Wide Two'), r1: player('r1', 'RB', ['TB'], 'Run One'), q1: player('q1', 'QB', ['TB'], 'Quarter One'), t1: player('t1', 'TE', ['KC'], 'Tight One') },
    teamWeeks: [
      teamWeek('TB', 1), teamWeek('TB', 2), teamWeek('TB', 3),
      teamWeek('KC', 1, { passAtt: 40, dropbacks: 42, airYds: 300 }), teamWeek('KC', 2, { passAtt: 40, dropbacks: 42, airYds: 300 }), teamWeek('KC', 3, { passAtt: 40, dropbacks: 42, airYds: 300 }),
    ],
    xfp: { QB: null, RB: null, WR: [1, 1.5, 0.05, 2, 0, 0], TE: null },
    rows: [
      row('q1', 1, 'TB', { pts: 20, pa_att: 30, pa_cmp: 20, pa_yds: 250, pa_td: 2, pa_int: 1, pa_sack: 2, pa_air: 240, pa_epa: 5, pa_cpoe: 3, snaps: 60, teamSnaps: 60 }),
      row('r1', 1, 'TB', { pts: 15, ru_att: 18, ru_yds: 90, ru_td: 1, ru_rz: 3, re_tgt: 3, re_rec: 2, re_yds: 15, snaps: 40, teamSnaps: 60, routesEst: 12 }),
      row('w1', 1, 'TB', { pts: 18.5, re_tgt: 9, re_rec: 6, re_yds: 85, re_td: 1, re_fd: 4, re_air: 100, re_yac: 20, re_rz: 2, re_sep: 3, re_drop: 1, re_epa: 4, proj: 14, snaps: 50, teamSnaps: 60, routesEst: 27, xfp: 16 }),
      row('w2', 1, 'TB', { pts: 6, re_tgt: 4, re_rec: 3, re_yds: 30, re_air: 40, snaps: 30, teamSnaps: 60, routesEst: 16, xfp: 8 }),
      row('t1', 1, 'KC', { pts: 9, re_tgt: 5, re_rec: 4, re_yds: 50, re_air: 30, snaps: 45, teamSnaps: 60, routesEst: 32 }),
      row('q1', 2, 'TB', { pts: 25, pa_att: 35, pa_cmp: 25, pa_yds: 300, pa_td: 3, pa_sack: 1, pa_air: 260, pa_epa: 8, pa_cpoe: 5, snaps: 60, teamSnaps: 60 }),
      row('r1', 2, 'TB', { pts: 8, ru_att: 12, ru_yds: 40, re_tgt: 1, re_rec: 1, re_yds: 5, snaps: 30, teamSnaps: 60, routesEst: 9 }),
      row('w1', 2, 'TB', { pts: 11.5, re_tgt: 7, re_rec: 4, re_yds: 55, re_fd: 2, re_air: 80, re_yac: 10, re_rz: 1, re_sep: 2, re_epa: 1, proj: 15, snaps: 55, teamSnaps: 60, routesEst: 29, xfp: 12 }),
      row('w2', 2, 'TB', { pts: 12, re_tgt: 6, re_rec: 5, re_yds: 70, re_air: 50, snaps: 40, teamSnaps: 60, routesEst: 21, xfp: 11 }),
      row('t1', 2, 'KC', { pts: 4, re_tgt: 2, re_rec: 2, re_yds: 20, re_air: 10, snaps: 40, teamSnaps: 60, routesEst: 28 }),
      row('q1', 3, 'TB', { pts: 10, pa_att: 25, pa_cmp: 15, pa_yds: 150, pa_int: 2, pa_sack: 3, pa_air: 200, pa_epa: -4, pa_cpoe: -2, snaps: 60, teamSnaps: 60 }),
      row('r1', 3, 'TB', { pts: 22, ru_att: 20, ru_yds: 120, ru_td: 2, ru_rz: 4, re_tgt: 2, re_rec: 2, re_yds: 20, snaps: 45, teamSnaps: 60, routesEst: 14 }),
      row('w1', 3, 'KC', { pts: 20, re_tgt: 10, re_rec: 7, re_yds: 110, re_td: 1, re_fd: 5, re_air: 120, re_yac: 30, re_rz: 2, re_epa: 6, proj: 13, snaps: 58, teamSnaps: 60, routesEst: 41, xfp: 19 }),
      row('t1', 3, 'KC', { pts: 14, re_tgt: 6, re_rec: 5, re_yds: 60, re_td: 1, re_air: 40, snaps: 50, teamSnaps: 60, routesEst: 35 }),
    ],
  };
}
