import { fitOls } from './ols';
import { round2 } from '../scoring';
import { DB_POSITIONS, type DbPos, type PlayerWeek, type PlayerWeekKey, type XfpCoefficients } from './types';

/** Opportunity features per position; the model is pts = c0 + Σ ci · feature_i. */
export const XFP_FEATURES: Readonly<Record<DbPos, readonly PlayerWeekKey[]>> = {
  QB: ['pa_att', 'pa_air', 'pa_rz', 'ru_att', 'ru_rz'],
  RB: ['re_tgt', 're_air', 're_rz', 'ru_att', 'ru_rz'],
  WR: ['re_tgt', 're_air', 're_rz', 'ru_att', 'ru_rz'],
  TE: ['re_tgt', 're_air', 're_rz', 'ru_att', 'ru_rz'],
};
export const XFP_MIN_ROWS = 50;

export const xfpFeatures = (pos: DbPos, row: PlayerWeek): number[] => [1, ...XFP_FEATURES[pos].map((k) => row[k] ?? 0)];

/** One OLS fit per position over played rows with at least one opportunity; null under XFP_MIN_ROWS rows. */
export function fitXfpCoefficients(rows: PlayerWeek[], posOf: (id: string) => DbPos | null): XfpCoefficients {
  const out = { QB: null, RB: null, WR: null, TE: null } as XfpCoefficients;
  for (const pos of DB_POSITIONS) {
    const X: number[][] = [], y: number[] = [];
    for (const r of rows) {
      if (r.gp < 1 || r.pts === undefined || posOf(r.id) !== pos) continue;
      const f = xfpFeatures(pos, r);
      if (f.slice(1).every((v) => v === 0)) continue;
      X.push(f); y.push(r.pts);
    }
    out[pos] = X.length >= XFP_MIN_ROWS ? fitOls(X, y) : null;
  }
  return out;
}

export function predictXfp(coef: number[] | null, pos: DbPos, row: PlayerWeek): number | null {
  if (!coef) return null;
  const f = xfpFeatures(pos, row);
  return round2(coef.reduce((s, c, j) => s + c * f[j], 0));
}
