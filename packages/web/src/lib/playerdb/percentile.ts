import { VALUE_SATURATION, valueColor } from '../draft';
import type { Agg } from './aggregate';
import { belowMin, columnValue, type ColumnDef, type Mode } from './columns';

/** 0..1 by average rank among the non-null values (ties share a rank); a lone value sits at 0.5. */
export function percentiles(values: (number | null)[]): (number | null)[] {
  const idx = values.map((v, i) => [v, i] as const).filter((p): p is readonly [number, number] => p[0] !== null).sort((a, b) => a[0] - b[0]);
  const out: (number | null)[] = values.map(() => null);
  const n = idx.length;
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
    const rank = (i + j) / 2;
    for (let k = i; k <= j; k++) out[idx[k][1]] = n === 1 ? 0.5 : rank / (n - 1);
    i = j + 1;
  }
  return out;
}

/** Cell background for a percentile on the draft board's red → yellow → green scale: yellow at the midpoint, red at the bottom, green at the top (flipped for lower-is-better). */
export function tintFor(p: number | null, lowerIsBetter = false): string {
  if (p === null) return 'transparent';
  const s = (p - 0.5) * 2 * (lowerIsBetter ? -1 : 1);
  return valueColor(s * VALUE_SATURATION);
}

/**
 * Every row's background for one column, in the order of `aggs`. A column with a fixed `score` uses it;
 * otherwise rows are tinted by percentile among the rows given. Rows under the sample minimum stay untinted,
 * and so does a zero counting stat, unless it is a lower-is-better count the player had the chance to record.
 */
export function columnTints(col: ColumnDef, aggs: Agg[], mode: Mode): string[] {
  if (col.tinted === false) return aggs.map(() => 'transparent');
  if (col.score) return aggs.map((a) => { const s = belowMin(col, a) ? null : col.score!(a); return s === null ? 'transparent' : valueColor(s * VALUE_SATURATION); });
  const values = aggs.map((a) => {
    if (belowMin(col, a)) return null;
    const v = columnValue(col, a, mode);
    return v === 0 && col.zeroFill && !col.tintZero?.(a) ? null : v;
  });
  return percentiles(values).map((p) => tintFor(p, col.lowerIsBetter));
}
