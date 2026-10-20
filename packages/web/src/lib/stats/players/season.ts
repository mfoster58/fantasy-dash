import { RZ_KEYS, type ChartDb, type ChartPlayer, type Counts, type PlayCounts, type PlayerDb, type PlayerId, type PlayerWeek } from '@fantasy-dash/core';
import { gameStates } from './health';

export type Pos = 'QB' | 'RB' | 'WR' | 'TE';
type N = number | null;
export interface PlayerStat {
  id: PlayerId; name: string; pos: Pos; team: string; games: number; healthy: number;
  ppg: N; xppg: N;
  att: number; dropbacks: number; anya: N; cpoe: N; aggr: N; epaDb: N; epa13: N; epa4: N; db4: number;
  car: number; snapPct: N; wopg: N; ypc: N; ypt: N; ryoe: N; succ: N; expl: N; rzX: N; rzA: N;
  tgt: number; routes: number; routesEst: boolean; yds: number; yprr: N; tprr: N; fdrr: N; adot: N; sep: N; catchPct: N; tgtShare: N;
  clean: N; press: N; cleanDb: number; pressDb: number; manEpa: N; zoneEpa: N; manDb: number; zoneDb: number; manYpt: N; zoneYpt: N; manTgt: number; zoneTgt: number;
}

const ratio = (n: number, d: number): N => (d > 0 && Number.isFinite(n / d) ? n / d : null);
const sum = (rs: PlayerWeek[], k: keyof PlayerWeek) => rs.reduce((s, r) => s + (typeof r[k] === 'number' ? (r[k] as number) : 0), 0);
const mean = (rs: PlayerWeek[], k: keyof PlayerWeek): N => { const v = rs.map((r) => r[k]).filter((x): x is number => typeof x === 'number'); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
/** targets, yards, epa summed over a route table */
const total = (t: Partial<Record<string, Counts>> | undefined): [number, number, number] =>
  Object.values(t ?? {}).reduce<[number, number, number]>((a, c) => [a[0] + (c?.[0] ?? 0), a[1] + (c?.[2] ?? 0), a[2] + (c?.[3] ?? 0)], [0, 0, 0]);

export interface WeekRange { from: number; to: number }

const addInto = (into: Counts | undefined, c: Counts | undefined): Counts | undefined => (c ? (into ? into.map((v, i) => v + (c[i] ?? 0)) : [...c]) : into);
/** His play-by-play counts: the season's totals, or for a range the weeks inside it summed (none when weeks aren't stored). */
function playsFor(c: ChartPlayer | undefined, range: WeekRange | undefined): PlayCounts | undefined {
  const p = c?.plays;
  if (!p || !range) return p;
  if (!p.weeks) return undefined;
  const out: PlayCounts = {};
  for (const [w, x] of Object.entries(p.weeks)) {
    const n = Number(w);
    if (n < range.from || n > range.to) continue;
    out.rush = addInto(out.rush, x.rush);
    out.qtr = addInto(out.qtr, x.qtr);
    for (const [k, v] of Object.entries(x.rz ?? {})) (out.rz ??= {})[k as keyof NonNullable<PlayCounts['rz']>] = addInto(out.rz?.[k as keyof NonNullable<PlayCounts['rz']>], v);
  }
  return out;
}

/** League points per red-zone opportunity for each band and type. */
function rzAverages(charts: ChartDb | undefined, range: WeekRange | undefined): Record<string, number> {
  const acc: Record<string, [number, number]> = {};
  for (const p of Object.values(charts?.players ?? {})) for (const [k, c] of Object.entries(playsFor(p, range)?.rz ?? {})) if (c) { const a = (acc[k] ??= [0, 0]); a[0] += c[0]; a[1] += c[1]; }
  return Object.fromEntries(Object.entries(acc).map(([k, [n, pts]]) => [k, n ? pts / n : 0]));
}

/** Season-to-date stats for every QB/RB/WR/TE with a game played. Per-game averages use healthy games only. */
export function seasonStats(db: PlayerDb, charts: ChartDb | undefined, range?: WeekRange): PlayerStat[] {
  const states = gameStates(db, charts?.injuries);
  const rows = new Map<PlayerId, PlayerWeek[]>();
  for (const r of [...db.rows].sort((a, b) => a.week - b.week)) {
    if (range && (r.week < range.from || r.week > range.to)) continue; const l = rows.get(r.id) ?? []; l.push(r); rows.set(r.id, l); }
  const rz = rzAverages(charts, range);
  const out: PlayerStat[] = [];
  for (const [id, all] of rows) {
    const p = db.players[id];
    const played = all.filter((r) => r.gp);
    if (!p || !played.length) continue;
    const st = states.get(id)!;
    const healthy = played.filter((r) => st.get(r.week) === 'healthy');
    const c = p.gsisId ? charts?.players[p.gsisId] : undefined;
    const att = sum(played, 'pa_att'), sacks = sum(played, 'pa_sack'), dropbacks = att + sacks;
    const car = sum(played, 'ru_att'), tgt = sum(played, 're_tgt'), yds = sum(played, 're_yds');
    const real = played.some((r) => r.routes != null);
    const routes = real ? sum(played, 'routes') : sum(played, 'routesEst');
    const plays = playsFor(c, range);
    const q = plays?.qtr, ru = plays?.rush;
    const rzX = plays?.rz ? RZ_KEYS.reduce((s, k) => s + (plays.rz![k]?.[0] ?? 0) * (rz[k] ?? 0), 0) : null;
    const rzA = plays?.rz ? RZ_KEYS.reduce((s, k) => s + (plays.rz![k]?.[1] ?? 0), 0) : null;
    const sp = c?.splits, split = (k: 'clean' | 'pressured' | 'man' | 'zone') => sp?.[k];
    const man = total(c?.routes?.man), zone = total(c?.routes?.zone);
    const hasRoutes = !!c?.routes;
    out.push({
      id, name: p.name, pos: p.pos, team: played[played.length - 1].team, games: played.length, healthy: healthy.length,
      ppg: ratio(sum(healthy, 'pts'), healthy.length), xppg: ratio(sum(healthy, 'xfp'), healthy.length),
      att, dropbacks,
      anya: ratio(sum(played, 'pa_yds') + 20 * sum(played, 'pa_td') - 45 * sum(played, 'pa_int') - sum(played, 'pa_sackYds'), dropbacks),
      cpoe: mean(played, 'pa_cpoe'), aggr: mean(played, 'pa_aggr'), epaDb: ratio(sum(played, 'pa_epa'), dropbacks),
      epa13: q ? ratio(q[1], q[0]) : null, epa4: q ? ratio(q[3], q[2]) : null, db4: q?.[2] ?? 0,
      car, snapPct: ratio(sum(played, 'snaps'), sum(played, 'teamSnaps')),
      wopg: ratio(sum(healthy, 'ru_att') + 1.5 * sum(healthy, 're_tgt'), healthy.length),
      ypc: ratio(sum(played, 'ru_yds'), car), ypt: ratio(yds, tgt), ryoe: ratio(sum(played, 'ru_ryoe'), car),
      succ: ru ? ratio(ru[1], ru[0]) : null, expl: ru ? ratio(ru[2], ru[0]) : null,
      // red zone counts are season totals, so per game uses games played
      rzX: rzX === null ? null : ratio(rzX, played.length), rzA: rzA === null ? null : ratio(rzA, played.length),
      tgt, routes, routesEst: !real, yds, yprr: ratio(yds, routes), tprr: ratio(tgt, routes), fdrr: ratio(sum(played, 're_fd'), routes),
      adot: ratio(sum(played, 're_air'), tgt), sep: mean(played, 're_sep'), catchPct: ratio(sum(played, 're_rec'), tgt), tgtShare: mean(played, 're_tgtShare'),
      clean: split('clean') ? ratio(split('clean')![4], split('clean')![0]) : null, cleanDb: split('clean')?.[0] ?? 0,
      press: split('pressured') ? ratio(split('pressured')![4], split('pressured')![0]) : null, pressDb: split('pressured')?.[0] ?? 0,
      manEpa: split('man') ? ratio(split('man')![4], split('man')![0]) : null, manDb: split('man')?.[0] ?? 0,
      zoneEpa: split('zone') ? ratio(split('zone')![4], split('zone')![0]) : null, zoneDb: split('zone')?.[0] ?? 0,
      manYpt: hasRoutes ? ratio(man[1], man[0]) : null, zoneYpt: hasRoutes ? ratio(zone[1], zone[0]) : null, manTgt: man[0], zoneTgt: zone[0],
    });
  }
  return out;
}
