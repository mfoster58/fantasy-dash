import { scoreStats } from '../scoring';
import type { SleeperWeekStat, StatMap } from '../sleeper/types';
import { LeaguePointsSchema } from './schema';
import { fitXfpCoefficients, predictXfp } from './xfp';
import type { DbPos, LeaguePoints, PlayerDb, PlayerWeek, PointsRow, SharedPlayerDb, XfpCoefficients } from './types';

export const NO_XFP: XfpCoefficients = { QB: null, RB: null, WR: null, TE: null };

/** Take a league's pts / proj / xfp off a playerdb: the shared file plus the league's points file. applyLeaguePoints undoes it exactly. */
export function splitLeaguePoints(db: PlayerDb, leagueId: string, builtAt: string): { shared: SharedPlayerDb; points: LeaguePoints } {
  const players: Record<string, PointsRow[]> = {};
  const rows = db.rows.map((r) => {
    const { pts, proj, xfp, ...rest } = r;
    if (pts !== undefined) (players[r.id] ??= []).push([r.week, pts, proj ?? null, xfp ?? null]);
    return rest as PlayerWeek;
  });
  const { xfp, ...meta } = db;
  return { shared: { ...meta, rows }, points: { year: db.year, leagueId, builtAt, dbBuiltAt: db.builtAt, xfp, players } };
}

/** The shared playerdb with one league's numbers joined on; rows the league has no entry for stay unscored. */
export function applyLeaguePoints(shared: SharedPlayerDb, points: LeaguePoints | null): PlayerDb {
  const at = new Map<string, PointsRow>();
  if (points) for (const [id, list] of Object.entries(points.players)) for (const t of list) at.set(`${id}|${t[0]}`, t);
  const rows = shared.rows.map((r) => {
    const t = at.get(`${r.id}|${r.week}`);
    if (!t) return r;
    const out: PlayerWeek = { ...r, pts: t[1] };
    if (t[2] !== null) out.proj = t[2];
    if (t[3] !== null) out.xfp = t[3];
    return out;
  });
  return { ...shared, xfp: points?.xfp ?? NO_XFP, rows };
}

/** Score every shared row with one league's scoring, fit that league's xFP on it, and keep only the league's numbers. */
export function buildLeaguePoints(input: {
  shared: SharedPlayerDb; leagueId: string; builtAt: string; scoring: Record<string, number>;
  sleeperWeeks: Map<number, SleeperWeekStat[]>; projections: Map<number, StatMap>;
}): LeaguePoints {
  const { shared, scoring } = input;
  const stats = new Map<string, Record<string, number>>();
  for (const [week, raws] of input.sleeperWeeks) for (const raw of raws) if (raw.stats) stats.set(`${raw.player_id}|${week}`, raw.stats);
  const rows = shared.rows.map((r) => {
    const st = stats.get(`${r.id}|${r.week}`);
    if (!st) return r;
    const out: PlayerWeek = { ...r, pts: scoreStats(st, scoring) };
    const proj = input.projections.get(r.week)?.[r.id];
    if (proj) out.proj = scoreStats(proj, scoring);
    return out;
  });
  const posOf = (id: string): DbPos | null => shared.players[id]?.pos ?? null;
  const xfp = fitXfpCoefficients(rows, posOf);
  for (const r of rows) {
    const pos = posOf(r.id);
    if (!pos || r.pts === undefined) continue;
    const v = predictXfp(xfp[pos], pos, r);
    if (v !== null) r.xfp = v;
  }
  return splitLeaguePoints({ ...shared, xfp, rows }, input.leagueId, input.builtAt).points;
}

/** Whether an existing points file was built for this league against this exact shared playerdb file. */
export function pointsUpToDate(existing: unknown, want: { leagueId: string; dbBuiltAt: string }): boolean {
  const parsed = LeaguePointsSchema.safeParse(existing);
  return parsed.success && parsed.data.leagueId === want.leagueId && parsed.data.dbBuiltAt === want.dbBuiltAt;
}
