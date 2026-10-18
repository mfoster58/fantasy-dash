import type { ChartDb, ChartPlayer, Counts } from '@fantasy-dash/core';
import { percentiles } from '../playerdb/percentile';

export interface MetricDef { label: string; value: (c: Counts) => number | null; fmt: (v: number) => string; lowerIsBetter?: boolean }

export interface ChartSpec<K extends string, F extends string> {
  keys: readonly K[];
  /** his table by filter; undefined when he has none */
  table: (p: ChartPlayer) => Record<F, Partial<Record<K, Counts>>> | undefined;
  /** volume (counts[0]) on an item needed to be ranked */
  min: number;
  /** total volume in a filter needed to be in the share pool */
  sharePool: Record<F, number>;
  /** share at which the heat scale is full */
  shareMax: number;
  /** volume unit for small text: tgt, car, att, db */
  unit: string;
  metrics: Record<string, MetricDef>;
}

export interface ChartItem<K extends string> {
  key: K;
  counts: Counts;
  volume: number;
  share: number;
  sharePct: number | null;
  /** the selected metric's value; the share when the metric is 'share' */
  value: number | null;
  /** 0–100 among his position; null when unranked */
  pct: number | null;
  ranked: boolean;
}

const total = (t: Partial<Record<string, Counts>> | undefined) => Object.values(t ?? {}).reduce((a, c) => a + (c?.[0] ?? 0), 0);
const rankOf = (values: (number | null)[], idx: number): number | null => { const p = percentiles(values)[idx]; return p === null ? null : Math.round(p * 100); };

export function hasChart<K extends string, F extends string>(spec: ChartSpec<K, F>, db: ChartDb, gsis: string): boolean {
  const t = db.players[gsis] ? spec.table(db.players[gsis]) : undefined;
  return !!t && Object.values(t).some((f) => Object.keys(f as object).length > 0);
}

/** His items in one filter, each with its share and the selected metric, ranked within his position. */
export function chartItems<K extends string, F extends string>(spec: ChartSpec<K, F>, db: ChartDb, gsis: string, filter: F, metric: string): ChartItem<K>[] | null {
  const me = db.players[gsis];
  const mine = me ? spec.table(me)?.[filter] : undefined;
  if (!me || !mine) return null;
  const peers = Object.entries(db.players).filter(([, p]) => p.pos === me.pos).map(([g, p]) => ({ g, t: spec.table(p)?.[filter] }));
  const myTotal = total(mine);
  const sharePeers = peers.filter((p) => p.g === gsis || total(p.t) >= spec.sharePool[filter]);
  const def = metric === 'share' ? null : spec.metrics[metric];
  return spec.keys.filter((k) => mine[k]).map((k) => {
    const counts = mine[k]!;
    const volume = counts[0];
    const share = myTotal ? volume / myTotal : 0;
    const sharePct = rankOf(sharePeers.map((p) => { const t = total(p.t); return t ? (p.t?.[k]?.[0] ?? 0) / t : 0; }), sharePeers.findIndex((p) => p.g === gsis));
    if (!def) return { key: k, counts, volume, share, sharePct, value: share, pct: sharePct, ranked: true };
    const value = def.value(counts);
    const ranked = volume >= spec.min && value !== null;
    const pool = peers.filter((p) => (p.t?.[k]?.[0] ?? 0) >= spec.min);
    const sign = def.lowerIsBetter ? -1 : 1;
    const pct = ranked ? rankOf(pool.map((p) => { const v = def.value(p.t![k]!); return v === null ? null : sign * v; }), pool.findIndex((p) => p.g === gsis)) : null;
    return { key: k, counts, volume, share, sharePct, value, pct, ranked };
  });
}
