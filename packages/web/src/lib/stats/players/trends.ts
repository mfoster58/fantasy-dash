import type { ChartDb, PlayerDb, PlayerId, PlayerWeek, TeamWeek } from '@fantasy-dash/core';
import { currentInjury, gameStates, type GameState } from './health';

export type TrendPos = 'RB' | 'WR' | 'TE';
export interface TrendCell { weeks: { week: number; state: GameState; value: number | null }[]; change: number | null }
export interface TrendRow { id: PlayerId; name: string; team: string; cells: Record<string, TrendCell>; score: number }
export interface Trends {
  weeks: number[]; columns: { key: string; label: string }[]; up: TrendRow[]; down: TrendRow[];
  injured: { id: PlayerId; name: string; team: string; status: string; injury: string }[];
}

type Metric = { key: string; label: string; value: (r: PlayerWeek, t: TeamWeek, teamXfp: number) => number | null };
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);
const RB_COLS: Metric[] = [
  { key: 'snap', label: 'Snap %', value: (r) => pct(r.snaps ?? 0, r.teamSnaps ?? 0) },
  { key: 'rush', label: 'Rush share', value: (r, t) => pct(r.ru_att ?? 0, t.rushAtt) },
  { key: 'tgt', label: 'Target share', value: (r, t) => pct(r.re_tgt ?? 0, t.passAtt) },
  { key: 'xfp', label: 'xFP share', value: (r, _t, x) => pct(r.xfp ?? 0, x) },
  { key: 'opp', label: 'Opportunities', value: (r) => (r.ru_att ?? 0) + (r.re_tgt ?? 0) },
];
const REC_COLS: Metric[] = [
  { key: 'snap', label: 'Snap %', value: (r) => pct(r.snaps ?? 0, r.teamSnaps ?? 0) },
  { key: 'route', label: 'Route share', value: (r, t) => pct(r.routes ?? r.routesEst ?? 0, t.dropbacks) },
  { key: 'tgt', label: 'Target share', value: (r, t) => pct(r.re_tgt ?? 0, t.passAtt) },
  { key: 'ay', label: 'Air yards share', value: (r) => (r.re_ayShare == null ? null : Math.round(r.re_ayShare * 100)) },
  { key: 'xfp', label: 'xFP share', value: (r, _t, x) => pct(r.xfp ?? 0, x) },
];
const MIN_VOLUME: Record<TrendPos, number> = { RB: 25, WR: 15, TE: 10 };
const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

/** Last two weeks against the weeks before, healthy games only, for the season's last five scored weeks. */
export function trends(db: PlayerDb, charts: ChartDb | undefined, pos: TrendPos, lastWeek = db.throughWeek, firstWeek?: number): Trends {
  const cols = pos === 'RB' ? RB_COLS : REC_COLS;
  // the league's last scored week: a finished season's week 18 is unscored and starters rest
  const last = Math.min(db.throughWeek, lastWeek);
  // a picked range is the window; otherwise the last five weeks
  const first = firstWeek !== undefined ? Math.max(1, Math.min(firstWeek, last)) : Math.max(1, last - 4);
  const weeks = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const lateWeeks = new Set(weeks.slice(-2));
  const states = gameStates(db, charts?.injuries);
  const tw = new Map(db.teamWeeks.map((t) => [`${t.team}|${t.week}`, t] as const));
  const teamXfp = new Map<string, number>();
  for (const r of db.rows) if (r.gp && r.xfp) teamXfp.set(`${r.team}|${r.week}`, (teamXfp.get(`${r.team}|${r.week}`) ?? 0) + r.xfp);
  const byId = new Map<PlayerId, Map<number, PlayerWeek>>();
  for (const r of db.rows) { let m = byId.get(r.id); if (!m) byId.set(r.id, (m = new Map())); m.set(r.week, r); }

  const rows: TrendRow[] = [];
  const injured: Trends['injured'] = [];
  for (const [id, byWeek] of byId) {
    const p = db.players[id];
    if (!p || p.pos !== pos) continue;
    const st = states.get(id)!;
    const inWindow = weeks.map((w) => byWeek.get(w)).filter((r): r is PlayerWeek => !!r && !!r.gp);
    const vol = inWindow.reduce((s, r) => s + (pos === 'RB' ? (r.ru_att ?? 0) + (r.re_tgt ?? 0) : r.re_tgt ?? 0), 0);
    if (vol < MIN_VOLUME[pos]) continue;
    const team = inWindow[inWindow.length - 1]?.team ?? p.teams[p.teams.length - 1];
    const inj = currentInjury(p.gsisId, charts?.injuries);
    if (inj) { injured.push({ id, name: p.name, team, ...inj }); continue; }
    const healthyLate = weeks.filter((w) => lateWeeks.has(w) && st.get(w) === 'healthy');
    const healthyEarly = weeks.filter((w) => !lateWeeks.has(w) && st.get(w) === 'healthy');
    if (healthyLate.length < 1 || healthyEarly.length < 2) continue;
    const cells: Record<string, TrendCell> = {};
    for (const c of cols) {
      const cellWeeks = weeks.map((w) => {
        const r = byWeek.get(w), t = r ? tw.get(`${r.team}|${w}`) : undefined, state = st.get(w) ?? 'missed';
        return { week: w, state, value: r && r.gp && t ? c.value(r, t, teamXfp.get(`${r.team}|${w}`) ?? 0) : null };
      });
      const val = (ws: number[]) => ws.map((w) => cellWeeks.find((x) => x.week === w)!.value).filter((v): v is number => v != null);
      const late = val(healthyLate), early = val(healthyEarly);
      cells[c.key] = { weeks: cellWeeks, change: late.length && early.length ? avg(late) - avg(early) : null };
    }
    rows.push({ id, name: p.name, team, cells, score: 0 });
  }
  // each change in standard deviations of that column's changes, averaged
  const z = new Map<PlayerId, number[]>(rows.map((r) => [r.id, []]));
  for (const c of cols) {
    const ch = rows.map((r) => r.cells[c.key].change).filter((v): v is number => v != null);
    if (!ch.length) continue;
    const mu = avg(ch), sd = Math.sqrt(avg(ch.map((v) => (v - mu) ** 2)));
    if (sd > 0) for (const r of rows) { const v = r.cells[c.key].change; if (v != null) z.get(r.id)!.push(v / sd); }
  }
  for (const r of rows) { const zs = z.get(r.id)!; r.score = zs.length ? Math.round(avg(zs) * 100) / 100 : 0; }
  rows.sort((a, b) => b.score - a.score);
  return {
    weeks, columns: cols.map(({ key, label }) => ({ key, label })),
    up: rows.slice(0, Math.min(10, rows.length)),
    down: rows.slice(Math.max(Math.min(10, rows.length), rows.length - 6)).reverse(),
    injured,
  };
}
