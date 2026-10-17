import type { UserId } from '@fantasy-dash/core';
import type { TeamGame } from '../managerGames';
import { byWeek, medianOf, regular } from './scope';

export interface ConsistencyRow { id: UserId; games: number; min: number; floor: number; median: number; ceiling: number; max: number }
export interface LuckRow { id: UserId; w: number; l: number; t: number; medianW: number; medianL: number; delta: number }
export interface SosRow { id: UserId; faced: number; leagueAvg: number; delta: number }
export interface PairRecord { w: number; l: number; t: number; realW: number; realL: number; realT: number }
export interface AllPlayGrid { ids: UserId[]; cells: Record<UserId, Record<UserId, PairRecord>> }
export interface PostseasonRow { id: UserId; regPpg: number; postPpg: number; postGames: number; delta: number }

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const group = (games: TeamGame[]): Map<UserId, TeamGame[]> => {
  const m = new Map<UserId, TeamGame[]>();
  for (const g of games) m.set(g.userId, [...(m.get(g.userId) ?? []), g]);
  return m;
};

/** worst to best regular-season week, with the floor and ceiling one week in from the ends once there are four */
export function consistency(games: TeamGame[]): ConsistencyRow[] {
  const rows: ConsistencyRow[] = [];
  for (const [id, mine] of group(regular(games))) {
    const pts = mine.map((g) => g.points).sort((x, y) => x - y);
    const n = pts.length;
    const inset = n >= 4 ? 1 : 0;
    rows.push({ id, games: n, min: pts[0], floor: pts[inset], median: medianOf(pts), ceiling: pts[n - 1 - inset], max: pts[n - 1] });
  }
  return rows.sort((x, y) => y.median - x.median || (x.id < y.id ? -1 : 1));
}

/** the real regular-season record against the record a manager would have against the weekly league median */
export function scheduleLuck(games: TeamGame[]): LuckRow[] {
  const rows = new Map<UserId, LuckRow>();
  for (const w of byWeek(regular(games))) {
    const median = medianOf(w.games.map((g) => g.points));
    for (const g of w.games) {
      const r = rows.get(g.userId) ?? { id: g.userId, w: 0, l: 0, t: 0, medianW: 0, medianL: 0, delta: 0 };
      if (g.result === 'W') r.w += 1; else if (g.result === 'L') r.l += 1; else r.t += 1;
      if (g.points > median) r.medianW += 1; else r.medianL += 1;
      rows.set(g.userId, r);
    }
  }
  return [...rows.values()].map((r) => ({ ...r, delta: r.w - r.medianW })).sort((x, y) => y.delta - x.delta || (x.id < y.id ? -1 : 1));
}

/** what opponents scored against each manager, against the league's average weekly score */
export function strengthOfSchedule(games: TeamGame[]): SosRow[] {
  const reg = regular(games);
  const leagueAvg = round2(mean(reg.map((g) => g.points)));
  return [...group(reg)].map(([id, mine]) => {
    const faced = round2(mean(mine.map((g) => g.oppPoints)));
    return { id, faced, leagueAvg, delta: round2(faced - leagueAvg) };
  }).sort((x, y) => y.delta - x.delta || (x.id < y.id ? -1 : 1));
}

/** for every ordered pair: the weeks the row outscored the column (both playing that regular week), plus the games they really played */
export function allPlayGrid(games: TeamGame[], ids: UserId[]): AllPlayGrid {
  const cells: AllPlayGrid['cells'] = {};
  const blank = (): PairRecord => ({ w: 0, l: 0, t: 0, realW: 0, realL: 0, realT: 0 });
  for (const a of ids) { cells[a] = {}; for (const b of ids) if (a !== b) cells[a][b] = blank(); }
  for (const w of byWeek(regular(games))) {
    for (const a of w.games) for (const b of w.games) {
      if (a.userId === b.userId || !cells[a.userId]?.[b.userId]) continue;
      const cell = cells[a.userId][b.userId];
      if (a.points > b.points) cell.w += 1; else if (a.points < b.points) cell.l += 1; else cell.t += 1;
      if (a.opponentId === b.userId) { if (a.result === 'W') cell.realW += 1; else if (a.result === 'L') cell.realL += 1; else cell.realT += 1; }
    }
  }
  return { ids, cells };
}

/** regular-season scoring against the postseason (every playoff-week game), for those who played one */
export function postseasonForm(games: TeamGame[]): PostseasonRow[] {
  const rows: PostseasonRow[] = [];
  for (const [id, mine] of group(games)) {
    const post = mine.filter((g) => g.isPlayoff);
    if (post.length === 0) continue;
    const regPpg = round2(mean(mine.filter((g) => !g.isPlayoff).map((g) => g.points)));
    const postPpg = round2(mean(post.map((g) => g.points)));
    rows.push({ id, regPpg, postPpg, postGames: post.length, delta: round2(postPpg - regPpg) });
  }
  return rows.sort((x, y) => y.delta - x.delta || (x.id < y.id ? -1 : 1));
}
