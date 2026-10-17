import { fitOls } from '@fantasy-dash/core';
import type { PlayerLine } from './playerLines';

export const XFP_POSITIONS: readonly string[] = ['QB', 'RB', 'WR', 'TE'];
export const MIN_FIT_LINES = 20;

/** Expected fantasy points from volume: points = a + b1·targets + b2·carries + b3·passAttempts, one fit per position. */
export interface XfpModel {
  /** [a, b1, b2, b3] per position; null when that position has no model */
  coef: Record<string, number[] | null>;
  predict(line: PlayerLine): number | null;
}

const features = (l: PlayerLine) => [1, l.targets, l.carries, l.passAttempts];

export function fitXfp(lines: PlayerLine[]): XfpModel {
  const coef: Record<string, number[] | null> = {};
  for (const pos of XFP_POSITIONS) {
    const rows = lines.filter((l) => l.played && l.position === pos);
    coef[pos] = rows.length < MIN_FIT_LINES ? null : fitOls(rows.map(features), rows.map((l) => l.points));
  }
  return {
    coef,
    predict(line) {
      const c = coef[line.position];
      if (!c) return null;
      const f = features(line);
      return Math.round(c.reduce((s, b, j) => s + b * f[j], 0) * 100) / 100;
    },
  };
}
