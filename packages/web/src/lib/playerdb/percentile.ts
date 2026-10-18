import { VALUE_SATURATION, valueColor } from '../draft';

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
