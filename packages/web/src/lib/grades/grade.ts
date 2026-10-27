import type { ChartDb, DbPos, GradeSums, PlayerDb, PlayerId } from '@fantasy-dash/core';
import { aggregate, type Agg } from '../playerdb/aggregate';
import { percentiles } from '../playerdb/percentile';
import { CARDS, type CardDef, type GradeInput, type Group, type TileDef } from './defs';

export interface GradedTile { key: string; label: string; text: string; detail: string; pct: number | null; style: boolean; status: 'ranked' | 'small' | 'noFtn' | 'none' }
export interface GradedCard { key: string; title: string; group: Group; tiles: GradedTile[] }
export interface SummaryRow { label: string; card: string; text: string; pct: number }

/** Volume per week of the season needed to be ranked at all: targets, carries or dropbacks. */
const VOLUME: Record<DbPos, { perWeek: number; of: (a: Agg) => number }> = {
  WR: { perWeek: 4, of: (a) => a.s.re_tgt ?? 0 },
  TE: { perWeek: 4, of: (a) => a.s.re_tgt ?? 0 },
  RB: { perWeek: 7, of: (a) => a.s.ru_att ?? 0 },
  QB: { perWeek: 15, of: (a) => (a.s.pa_att ?? 0) + (a.s.pa_sack ?? 0) },
};
/** Fallback when the league's scoring settings aren't to hand: PPR, 0.1 a yard, 6 a TD. */
export const STANDARD_SCORING: Record<string, number> = { rush_yd: 0.1, rush_td: 6, rush_2pt: 2, rec: 1, rec_yd: 0.1, rec_td: 6, rec_2pt: 2 };
/** a tile's own sample needed to be ranked */
const TILE_MIN = 5;

const cardsFor = (pos: DbPos): CardDef[] => CARDS[pos === 'TE' ? 'WR' : pos];
const usable = (v: number | null): v is number => v !== null && Number.isFinite(v);

/** Whether a tile can be read for this player, and if not why. */
function blocked(t: TileDef, x: GradeInput): GradedTile['status'] | null {
  if (t.ftnOnly && (!x.ftn || (t.denom?.(x) ?? 1) === 0)) return 'noFtn';
  if (!usable(t.value(x))) return 'none';
  return null;
}
const rankValue = (t: TileDef, x: GradeInput): number | null => {
  const v = t.value(x);
  if (!usable(v)) return null;
  return t.perGame ? (x.agg.games > 0 ? v / x.agg.games : null) : v;
};

/**
 * His grade cards for the season, every tile ranked within his position (TE apart from WR) among players with enough volume.
 * Null when the position has no cards, he has no gsis id, or the chart file has no grade sums for him.
 */
export function gradeCards(db: PlayerDb, chart: ChartDb | undefined, id: PlayerId, scoring: Record<string, number> = STANDARD_SCORING): GradedCard[] | null {
  const me = db.players[id];
  if (!me || !VOLUME[me.pos] || !me.gsisId || !chart) return null;
  const mine = chart.players[me.gsisId]?.grades;
  if (!mine) return null;
  const ftn = chart.ftn === true;
  const vol = VOLUME[me.pos];
  const qualifies = (a: Agg) => vol.of(a) >= vol.perWeek * a.weeks;
  // his teams' totals in the weeks he played (a game played, targeted or not), for whichever team he played them for
  const teamOf = (a: Agg): GradeInput['team'] => {
    const t = { rzTgt: 0, in10: 0, rzCar: 0 };
    for (const r of a.rows) {
      if (r.gp < 1) continue;
      const w = chart.teams?.[r.team]?.[String(r.week)];
      if (w) { t.rzTgt += w[0]; t.in10 += w[1]; t.rzCar += w[2] ?? 0; }
    }
    return t;
  };
  const inputOf = (a: Agg): GradeInput | null => {
    const gsis = db.players[a.id]?.gsisId;
    const g: GradeSums | undefined = gsis ? chart.players[gsis]?.grades : undefined;
    return g ? { agg: a, g, ftn, team: teamOf(a), scoring } : null;
  };
  const aggs = aggregate(db, 1, Math.max(1, db.throughWeek));
  const meAgg = aggs.find((a) => a.id === id);
  if (!meAgg) return null;
  const x: GradeInput = { agg: meAgg, g: mine, ftn, team: teamOf(meAgg), scoring };
  const pool = aggs.filter((a) => a.id !== id && db.players[a.id]?.pos === me.pos && qualifies(a)).map(inputOf).filter((p): p is GradeInput => p !== null);
  const meQualifies = qualifies(meAgg);

  const grade = (t: TileDef): GradedTile => {
    const base = { key: t.key, label: t.label, style: !!t.style, text: t.text(x), detail: t.detail(x), pct: null };
    const stop = blocked(t, x);
    if (stop === 'noFtn') return { ...base, text: '—', detail: 'no FTN data', status: stop };
    if (stop === 'none') return { ...base, text: '—', detail: 'none', status: stop };
    if (!meQualifies || (t.denom && t.denom(x) < TILE_MIN)) return { ...base, status: 'small' };
    const eligible = (p: GradeInput) => !blocked(t, p) && !(t.denom && t.denom(p) < TILE_MIN);
    const values = [rankValue(t, x), ...pool.map((p) => (eligible(p) ? rankValue(t, p) : null))];
    const p = percentiles(values)[0];
    if (p === null) return { ...base, status: 'small' };
    return { ...base, pct: Math.round((t.low ? 1 - p : p) * 100), status: 'ranked' };
  };

  return cardsFor(me.pos).map((c) => ({ key: c.key, title: c.title, group: c.group, tiles: c.tiles.map(grade) }));
}

/** His four best and four worst graded tiles (style and unranked tiles left out); fewer than eight split at the 50th percentile. */
export function scoutingSummary(cards: GradedCard[]): { best: SummaryRow[]; worst: SummaryRow[] } {
  const rows = cards.flatMap((c) => c.tiles.filter((t) => t.status === 'ranked' && !t.style && t.pct !== null).map((t) => ({ label: t.label, card: c.title, text: t.text, pct: t.pct! })));
  if (rows.length < 8) {
    return { best: rows.filter((r) => r.pct >= 50).sort((a, b) => b.pct - a.pct), worst: rows.filter((r) => r.pct < 50).sort((a, b) => a.pct - b.pct) };
  }
  // stable sorts keep card order between ties
  const best = [...rows].sort((a, b) => b.pct - a.pct).slice(0, 4);
  const worst = [...rows].sort((a, b) => a.pct - b.pct).filter((r) => !best.includes(r)).slice(0, 4);
  return { best, worst };
}
