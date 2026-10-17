import { teamWeekKey, type PlayerDb, type PlayerWeek, type PlayerWeekKey, type TeamWeek } from '@fantasy-dash/core';

export interface TeamTotals { passAtt: number; rushAtt: number; dropbacks: number; rzLooks: number; airYds: number }

/** One player's numbers over a week range. `s` are sums, `w` are weighted averages, `t` the totals of the team-weeks he played in. */
export interface Agg {
  id: string;
  /** team of his last week in the range */
  team: string;
  games: number;
  /** weeks in the range (for minimum scaling), not weeks played */
  weeks: number;
  s: Partial<Record<PlayerWeekKey, number>>;
  w: Partial<Record<PlayerWeekKey, number>>;
  t: TeamTotals;
  routes: number;
  routesEst: boolean;
  /** Σ (pts − proj) over weeks with a projection; null when none */
  projDiff: number | null;
  /** rank by Σ pts within his position over the same range; set by aggregate() */
  posRank: number | null;
  rows: PlayerWeek[];
}

/** Per-game rates from NGS, PFR and Sleeper, averaged with these weights. */
export const WEIGHTED: Partial<Record<PlayerWeekKey, PlayerWeekKey>> = {
  re_cush: 're_tgt', re_sep: 're_tgt', re_iay: 're_tgt', re_iayShare: 're_tgt', re_xyac: 're_rec', re_yacoe: 're_rec', re_rtg: 're_tgt',
  ru_ryoeAtt: 'ru_att', ru_eff: 'ru_att', ru_box8: 'ru_att', ru_tlos: 'ru_att',
  pa_ttt: 'pa_att', pa_iay: 'pa_att', pa_cay: 'pa_att', pa_aggr: 'pa_att', pa_ays: 'pa_att', pa_xcmp: 'pa_att', pa_cpoe: 'pa_att', pa_rtg: 'pa_att',
};
/** Source rates the table recomputes from sums instead. */
const SKIPPED = new Set<PlayerWeekKey>(['posRankPpr', 're_dropPct', 'pa_badPct', 'pa_pressPct', 're_tgtShare', 're_ayShare', 're_wopr', 're_racr', 'pa_pacr']);

const twIndex = new WeakMap<PlayerDb, Map<string, TeamWeek>>();
function teamWeekOf(db: PlayerDb, team: string, week: number): TeamWeek | undefined {
  let idx = twIndex.get(db);
  if (!idx) { idx = new Map(db.teamWeeks.map((t) => [teamWeekKey(t.team, t.week), t])); twIndex.set(db, idx); }
  return idx.get(teamWeekKey(team, week));
}

export function aggregateWeeks(db: PlayerDb, rows: PlayerWeek[], weeks: number): Agg {
  const s: Agg['s'] = {}, w: Agg['w'] = {};
  const wsum: Partial<Record<PlayerWeekKey, number>> = {}, wden: Partial<Record<PlayerWeekKey, number>> = {};
  const t: TeamTotals = { passAtt: 0, rushAtt: 0, dropbacks: 0, rzLooks: 0, airYds: 0 };
  let games = 0, routes = 0, projDiff: number | null = null;
  for (const r of rows) {
    if (r.gp >= 1) games++;
    for (const [k, v] of Object.entries(r) as [string, unknown][]) {
      if (typeof v !== 'number' || k === 'week' || k === 'gp') continue;
      const key = k as PlayerWeekKey;
      if (SKIPPED.has(key)) continue;
      const weightKey = WEIGHTED[key];
      if (weightKey) {
        const weight = r[weightKey] ?? 0;
        if (weight > 0) { wsum[key] = (wsum[key] ?? 0) + v * weight; wden[key] = (wden[key] ?? 0) + weight; }
      } else {
        s[key] = (s[key] ?? 0) + v;
      }
    }
    routes += (db.routesReal ? r.routes : r.routesEst) ?? 0;
    if (r.proj !== undefined && r.pts !== undefined) projDiff = (projDiff ?? 0) + (r.pts - r.proj);
    const tw = teamWeekOf(db, r.team, r.week);
    if (tw) { t.passAtt += tw.passAtt; t.rushAtt += tw.rushAtt; t.dropbacks += tw.dropbacks; t.rzLooks += tw.rzLooks; t.airYds += tw.airYds; }
  }
  for (const k of Object.keys(wsum) as PlayerWeekKey[]) w[k] = wsum[k]! / wden[k]!;
  const last = rows[rows.length - 1];
  return { id: last?.id ?? '', team: last?.team ?? '', games, weeks, s, w, t, routes, routesEst: !db.routesReal, projDiff, posRank: null, rows };
}

/** Every player with a row in weeks from..to, with position ranks by points. */
export function aggregate(db: PlayerDb, from: number, to: number): Agg[] {
  const grouped = new Map<string, PlayerWeek[]>();
  for (const r of db.rows) {
    if (r.week < from || r.week > to) continue;
    const list = grouped.get(r.id);
    if (list) list.push(r); else grouped.set(r.id, [r]);
  }
  const out = [...grouped.values()].map((rows) => aggregateWeeks(db, rows, to - from + 1));
  const byPos = new Map<string, Agg[]>();
  for (const a of out) {
    const pos = db.players[a.id]?.pos ?? '?';
    const list = byPos.get(pos);
    if (list) list.push(a); else byPos.set(pos, [a]);
  }
  for (const list of byPos.values()) {
    list.sort((a, b) => (b.s.pts ?? 0) - (a.s.pts ?? 0) || (a.id < b.id ? -1 : 1));
    list.forEach((a, i) => { a.posRank = i + 1; });
  }
  return out;
}
