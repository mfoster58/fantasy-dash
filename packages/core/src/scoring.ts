export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

/** Apply a league's scoring_settings to a raw stat line. */
export function scoreStats(
  stats: Record<string, number>,
  scoring: Record<string, number>,
): number {
  let total = 0;
  for (const [key, weight] of Object.entries(scoring)) {
    if (weight === 0) continue;
    const value = stats[key];
    if (typeof value === 'number') total += value * weight;
  }
  return round2(total);
}
