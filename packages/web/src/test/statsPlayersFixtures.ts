import type { ChartDb, PlayerDb, PlayerWeek } from '@fantasy-dash/core';
import { player, teamWeek } from './playerDbFixtures';

const TEAMS = ['AAA', 'BBB', 'CCC'];
const BYE: Record<string, number> = { CCC: 3 };

/** snap share per week (null = did not play), carries per week, targets per week */
type Line = { share: (number | null)[]; car?: number[]; tgt?: number[]; extra?: Partial<PlayerWeek> };
const LINES: Record<string, { pos: 'QB' | 'RB' | 'WR' | 'TE'; team: string; name: string } & Line> = {
  rUp:   { pos: 'RB', team: 'AAA', name: 'Rising Back', share: [0.3, 0.3, 0.3, 0.8, 0.85], car: [5, 5, 6, 18, 20], tgt: [1, 1, 1, 4, 5] },
  rDown: { pos: 'RB', team: 'BBB', name: 'Fading Back', share: [0.8, 0.8, 0.8, 0.3, 0.3], car: [18, 17, 18, 6, 5], tgt: [4, 4, 4, 1, 0] },
  rHurt: { pos: 'RB', team: 'AAA', name: 'Hurt Back', share: [0.9, 0.2, null, null, 0.85], car: [20, 3, 0, 0, 19], tgt: [5, 0, 0, 0, 4] },
  rOut:  { pos: 'RB', team: 'BBB', name: 'Out Back', share: [0.7, 0.7, 0.7, 0.5, 0.45], car: [15, 15, 15, 10, 9], tgt: [3, 3, 3, 2, 2] },
  rLast: { pos: 'RB', team: 'CCC', name: 'Last Week Back', share: [0.85, 0.8, null, 0.8, 0.05], car: [18, 17, 0, 18, 1], tgt: [4, 4, 0, 4, 0] },
  wA:    { pos: 'WR', team: 'AAA', name: 'Wide A', share: [0.9, 0.9, 0.9, 0.9, 0.9], tgt: [8, 8, 8, 9, 9] },
  wB:    { pos: 'WR', team: 'BBB', name: 'Wide B', share: [0.85, 0.85, 0.85, 0.85, 0.85], tgt: [6, 6, 6, 6, 7] },
  qA:    { pos: 'QB', team: 'AAA', name: 'Quarter A', share: [1, 1, 1, 1, 1], extra: { pa_att: 30, pa_cmp: 20, pa_yds: 250, pa_td: 2, pa_int: 1, pa_sack: 2, pa_sackYds: 14, pa_epa: 4, pa_cpoe: 2, pa_aggr: 15 } },
};

export function statsDb(): PlayerDb {
  const rows: PlayerWeek[] = [];
  for (const [id, l] of Object.entries(LINES)) {
    l.share.forEach((s, i) => {
      const week = i + 1;
      if (BYE[l.team] === week) return;
      const car = l.car?.[i] ?? 0, tgt = l.tgt?.[i] ?? 0;
      rows.push({ id, week, team: l.team, gp: s === null ? 0 : 1, opp: 'OPP', ...(s === null ? {} : {
        snaps: Math.round(s * 60), teamSnaps: 60, pts: car * 0.6 + tgt * 1.6, xfp: car * 0.55 + tgt * 1.5,
        ru_att: car, ru_yds: car * 4, ru_ryoe: car * 0.2, re_tgt: tgt, re_rec: Math.round(tgt * 0.7), re_yds: tgt * 8, re_fd: Math.round(tgt / 2), re_air: tgt * 9,
        routesEst: l.pos === 'RB' ? Math.round(s * 30) : Math.round(s * 35), re_tgtShare: tgt / 30, re_ayShare: tgt / 35, re_sep: 3, ...l.extra,
      }) });
    });
  }
  return {
    year: 2026, throughWeek: 5, routesReal: false, builtAt: '2026-10-19T00:00:00.000Z',
    players: Object.fromEntries(Object.entries(LINES).map(([id, l]) => [id, player(id, l.pos, [l.team], l.name)])),
    teamWeeks: TEAMS.flatMap((t) => [1, 2, 3, 4, 5].filter((w) => BYE[t] !== w).map((w) => teamWeek(t, w, { rushAtt: 25, passAtt: 30, dropbacks: 32 }))),
    xfp: { QB: null, RB: null, WR: null, TE: null }, rows,
  };
}

export function statsCharts(): ChartDb {
  return {
    year: 2026, builtAt: '2026-10-19T00:00:00.000Z', participation: false,
    injuries: {
      '00-rHurt': { '3': ['Out', 'Knee'], '4': ['Out', 'Knee'] },
      '00-rOut': { '6': ['Out', 'Groin'] },
      '00-wA': { '6': ['Questionable', 'Ankle'] },
    },
    players: {
      '00-rUp': { pos: 'RB', plays: { rush: [54, 27, 6, 216], rz: { ra: [4, 8], rc: [6, 3] } } },
      '00-rDown': { pos: 'RB', plays: { rush: [68, 26, 4, 250], rz: { ra: [6, 6], tb: [2, 4] } } },
      '00-qA': { pos: 'QB', plays: { qtr: [100, 10, 40, 8] } },
    },
  };
}
