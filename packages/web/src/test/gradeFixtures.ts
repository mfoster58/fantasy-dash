import type { ChartDb, GradeSums, PlayerDb, PlayerWeek } from '@fantasy-dash/core';
import { player, row, teamWeek } from './playerDbFixtures';

const WEEKS = [1, 2, 3, 4];
/** one row per week played, with the season's numbers split evenly */
const rows = (id: string, team: string, weeks: number[], season: Partial<PlayerWeek>): PlayerWeek[] =>
  weeks.map((w) => row(id, w, team, Object.fromEntries(Object.entries(season).map(([k, v]) => [k, (v as number) / weeks.length]))));

const recv = (tgt: number, g: GradeSums = {}): GradeSums => ({
  tgt, rec: tgt * 0.6, yds: tgt * 8, epa: tgt * 0.2, succ: tgt / 2, fd: tgt / 3, td: 2, cpN: tgt, cpSum: tgt * 0.6, cpRec: tgt * 0.6,
  deep: 6, deepRec: 3, deepYds: 150, deepEpa: 3, t3: 8, t3Conv: 4, rzTgt: 5, ezTgt: 3,
  ftnTgt: tgt, catchable: tgt * 0.8, drops: 2, contested: 6, contestedRec: 3, created: 1, motionTgt: tgt / 2, paTgt: tgt / 5, ...g,
});

/** four weeks: WRs wa/wb/wc/ws (ws under the volume minimum), TEs ta/tb, RBs ra/rb, QBs qa/qb */
export function gradeFixture(ftn = true): { db: PlayerDb; chart: ChartDb } {
  const db: PlayerDb = {
    year: 2026, throughWeek: 4, routesReal: false, builtAt: '2026-10-27T00:00:00.000Z',
    players: Object.fromEntries([
      player('wa', 'WR', ['TB']), player('wb', 'WR', ['TB']), player('wc', 'WR', ['KC']), player('ws', 'WR', ['KC']),
      player('ta', 'TE', ['TB']), player('tb', 'TE', ['KC']), player('ra', 'RB', ['TB']), player('rb', 'RB', ['KC']),
      player('qa', 'QB', ['TB']), player('qb', 'QB', ['KC']),
    ].map((p) => [p.id, p])),
    teamWeeks: WEEKS.flatMap((w) => [teamWeek('TB', w), teamWeek('KC', w)]),
    xfp: { QB: null, RB: null, WR: null, TE: null },
    rows: [
      ...rows('wa', 'TB', WEEKS, { re_tgt: 40, re_rec: 24, re_yds: 320, re_air: 400, snaps: 200, teamSnaps: 240, routesEst: 120 }),
      ...rows('wb', 'TB', [1, 2], { re_tgt: 30, re_rec: 20, re_yds: 250, re_air: 300, snaps: 100, teamSnaps: 120, routesEst: 60 }),
      ...rows('wc', 'KC', WEEKS, { re_tgt: 24, re_rec: 14, re_yds: 150, re_air: 200, snaps: 180, teamSnaps: 240, routesEst: 100 }),
      ...rows('ws', 'KC', WEEKS, { re_tgt: 8, re_rec: 4, re_yds: 40, re_air: 50, snaps: 60, teamSnaps: 240, routesEst: 40 }),
      ...rows('ta', 'TB', WEEKS, { re_tgt: 20, re_rec: 14, re_yds: 150, re_air: 120, snaps: 200, teamSnaps: 240, routesEst: 100 }),
      ...rows('tb', 'KC', WEEKS, { re_tgt: 18, re_rec: 12, re_yds: 120, re_air: 100, snaps: 180, teamSnaps: 240, routesEst: 90 }),
      ...rows('ra', 'TB', WEEKS, { ru_att: 60, ru_yds: 270, re_tgt: 10, snaps: 150, teamSnaps: 240 }),
      ...rows('rb', 'KC', WEEKS, { ru_att: 40, ru_yds: 160, re_tgt: 8, snaps: 120, teamSnaps: 240 }),
      ...rows('qa', 'TB', WEEKS, { pa_att: 120, pa_sack: 8, pa_yds: 900, snaps: 240, teamSnaps: 240 }),
      ...rows('qb', 'KC', WEEKS, { pa_att: 100, pa_sack: 10, pa_yds: 700, snaps: 240, teamSnaps: 240 }),
    ],
  };
  const qbSums = (dbs: number, g: GradeSums = {}): GradeSums => ({ db: dbs, dbEpa: dbs * 0.05, dbSucc: dbs / 2, att: dbs - 8, sacks: 8, sackYds: 50, passYds: 900, passTd: 6, int: 2, deepAtt: 10, deepCmp: 4, deepAttEpa: 2, deepCpoeSum: 20, deepCpoeN: 10, t3Db: 20, t3DbConv: 8, rzDb: 15, rzTd: 5, q4Db: 30, q4Epa: 1, trailDb: 40, trailEpa: 2, scr: 6, scrYds: 40, drun: 5, drunEpa: 1, rushFd: 4, ftnDb: dbs, ftnAtt: dbs - 8, iw: 3, readN: 100, firstRead: 60, throwaway: 4, faultSack: 2, catchableThrown: 90, recDrops: 5, paDb: 25, paEpa: 3, blitzDb: 30, blitzEpa: -2, noBlitzDb: 98, noBlitzEpa: 6, ...g });
  const rbSums = (car: number): GradeSums => ({ car, carYds: car * 4, carEpa: 1, carSucc: car / 2, carFd: car / 4, explosive: 6, stuffed: 8, in10: 8, in5: 6, in5Td: 3, outside: 10, ftnCar: car, boxN: car, boxSum: car * 7, lightCar: 20, lightYds: 100, heavyCar: 10, heavyYds: 30, rpo: 4, tgt: 10, epa: 2, yacN: 6, yacOe: 3 });
  const chart: ChartDb = {
    year: 2026, builtAt: '2026-10-27T00:00:00.000Z', participation: false, ftn, injuries: {},
    // each team: 5 red-zone targets and 3 inside-10 carries a week
    teams: { TB: Object.fromEntries(WEEKS.map((w) => [String(w), [5, 3] as [number, number]])), KC: Object.fromEntries(WEEKS.map((w) => [String(w), [5, 3] as [number, number]])) },
    players: {
      '00-wa': { pos: 'WR', grades: recv(40, { drops: 1, catchable: 30, deepYds: 300 }) },
      '00-wb': { pos: 'WR', grades: recv(30, { drops: 3, catchable: 20, deepYds: 200 }) },
      '00-wc': { pos: 'WR', grades: recv(24, { drops: 4, catchable: 16, deep: 4, deepYds: 100 }) },
      '00-ws': { pos: 'WR', grades: recv(8) },
      '00-ta': { pos: 'TE', grades: recv(20) },
      '00-tb': { pos: 'TE', grades: recv(18) },
      '00-ra': { pos: 'RB', grades: rbSums(60) },
      '00-rb': { pos: 'RB', grades: rbSums(40) },
      '00-qa': { pos: 'QB', grades: qbSums(128, { scr: 0, scrYds: 0 }) },
      '00-qb': { pos: 'QB', grades: qbSums(110) },
    },
  };
  return { db, chart };
}
