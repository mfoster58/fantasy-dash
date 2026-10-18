import type { PlayerDb, PlayerId } from '@fantasy-dash/core';
import { aggregate } from '../playerdb/aggregate';
import { COLUMNS, belowMin, columnValue, type Mode } from '../playerdb/columns';
import { percentiles } from '../playerdb/percentile';

export interface Metric { key: string; mode: Mode; label: string }
export interface Bar { key: string; label: string; mode: Mode; value: number | null; pct: number | null; small: boolean }

const m = (key: string, label: string, mode: Mode = 'total'): Metric => ({ key, label, mode });
const WR_TE = [m('snapPct', 'Snap%'), m('routePct', 'Route%'), m('tgtPct', 'Tgt share'), m('yprr', 'YPRR'), m('adotRe', 'aDOT'), m('sep', 'Separation'), m('catchPct', 'Catch%'), m('yacRec', 'YAC/rec'), m('dropPct', 'Drop%'), m('xfpPg', 'xFP/g'), m('fpoePg', 'FPOE/g')];
/** The spec's lists, each label mapped to a Players-table column; QB TD rate and INT rate have no column, so they read as TD/g and INT/g. */
export const METRICS: Record<'QB' | 'RB' | 'WR' | 'TE', Metric[]> = {
  QB: [m('paYds', 'Pass yds/g', 'pg'), m('cmpPct', 'Cmp%'), m('ya', 'Y/A'), m('paTd', 'Pass TD/g', 'pg'), m('int', 'INT/g', 'pg'), m('adot', 'aDOT'), m('cpoe', 'CPOE'), m('epaDb', 'EPA/db'), m('ruYds', 'Rush yds/g', 'pg'), m('xfpPg', 'xFP/g'), m('fpoePg', 'FPOE/g')],
  RB: [m('snapPct', 'Snap%'), m('carryPct', 'Carry share'), m('tgtPct', 'Tgt share'), m('ypc', 'YPC'), m('ryoeAtt', 'RYOE/att'), m('btTouch', 'BT/touch'), m('yprr', 'YPRR'), m('oppPct', 'Opp share'), m('xfpPg', 'xFP/g'), m('fpoePg', 'FPOE/g')],
  WR: WR_TE,
  TE: WR_TE,
};

/** Where he ranks among his position's qualifiers this season, 0–100 (higher is always better); null and small when he is under a column's minimum. */
export function percentileBars(db: PlayerDb, id: PlayerId): Bar[] | null {
  const pos = db.players[id]?.pos as keyof typeof METRICS | undefined;
  const metrics = pos ? METRICS[pos] : undefined;
  if (!metrics) return null;
  const aggs = aggregate(db, 1, Math.max(1, db.throughWeek));
  const me = aggs.find((a) => a.id === id);
  if (!me) return null;
  const peers = aggs.filter((a) => db.players[a.id]?.pos === pos);
  const idx = peers.indexOf(me);
  return metrics.map((mt) => {
    const col = COLUMNS[mt.key];
    const value = columnValue(col, me, mt.mode);
    const small = belowMin(col, me);
    if (small || value === null) return { key: mt.key, label: mt.label, mode: mt.mode, value, pct: null, small };
    const p = percentiles(peers.map((a) => (belowMin(col, a) ? null : columnValue(col, a, mt.mode))))[idx];
    return { key: mt.key, label: mt.label, mode: mt.mode, value, pct: p === null ? null : Math.round((col.lowerIsBetter ? 1 - p : p) * 100), small: false };
  });
}
