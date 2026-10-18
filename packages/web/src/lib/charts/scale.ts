/** Share on the heat scale: four theme tokens, mixed between neighbours, full at `max`. */
export function heatColor(share: number, max: number): string {
  const t = Math.min(1, Math.max(0, share / max)) * 3;
  const i = Math.min(2, Math.floor(t));
  const f = Math.round((t - i) * 100);
  if (f === 0) return `var(--heat-${i})`;
  if (f === 100 || t === 3) return `var(--heat-${i + 1})`;
  return `color-mix(in srgb, var(--heat-${i + 1}) ${f}%, var(--heat-${i}))`;
}

/** A 0–100 percentile on the percentile bars' red → yellow → green; grey when unranked. */
export function pctColor(p: number | null): string {
  if (p === null) return 'var(--dim)';
  if (p <= 0) return 'var(--loss)';
  if (p === 50) return 'var(--warn)';
  if (p >= 100) return 'var(--win)';
  return p < 50 ? `color-mix(in oklch, var(--warn) ${p * 2}%, var(--loss))` : `color-mix(in oklch, var(--win) ${(p - 50) * 2}%, var(--warn))`;
}

/** Text colour on a chip: the page ink on a dim heat chip (share under 9%), the on-chip token otherwise. */
export const chipInk = (fill: 'heat' | 'pct', share = 1): string => (fill === 'heat' && share < 0.09 ? 'var(--ink)' : 'var(--on-chip)');

export function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
}

export const fmtPct = (v: number) => `${Math.round(v * 100)}%`;
export const fmtDec1 = (v: number) => v.toFixed(1);
/** Signed, fixed places; a value that rounds to zero prints as +0.00. */
export function fmtSigned(v: number, places: number): string {
  const r = Number(v.toFixed(places));
  return `${r < 0 ? '-' : '+'}${Math.abs(r).toFixed(places)}`;
}
