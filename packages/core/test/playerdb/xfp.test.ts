import { describe, it, expect } from 'vitest';
import { fitOls } from '../../src/playerdb/ols';
import { XFP_FEATURES, XFP_MIN_ROWS, fitXfpCoefficients, predictXfp, xfpFeatures } from '../../src/playerdb/xfp';
import type { PlayerWeek } from '../../src/playerdb/types';

describe('fitOls', () => {
  it('recovers known coefficients and zeroes a constant column', () => {
    const X: number[][] = [], y: number[] = [];
    for (let i = 0; i < 30; i++) { const a = i % 7, b = (i * 3) % 11; X.push([1, a, b, 5]); y.push(2 + 0.5 * a - 1.25 * b); }
    const beta = fitOls(X, y)!;
    expect(beta[0]).toBeCloseTo(2, 6);
    expect(beta[1]).toBeCloseTo(0.5, 6);
    expect(beta[2]).toBeCloseTo(-1.25, 6);
    expect(beta[3]).toBe(0);
  });
});

describe('xfp', () => {
  const posOf = (id: string) => (id.startsWith('q') ? 'QB' : id.startsWith('w') ? 'WR' : null) as 'QB' | 'WR' | null;
  const rows: PlayerWeek[] = [];
  for (let i = 0; i < 60; i++) {
    const tgt = i % 12, air = (i * 7) % 90, rz = i % 3;
    rows.push({ id: `w${i}`, week: 1 + (i % 4), team: 'X', gp: 1, re_tgt: tgt, re_air: air, re_rz: rz, pts: 1 + 1.5 * tgt + 0.05 * air + 2 * rz });
  }
  rows.push({ id: 'q1', week: 1, team: 'X', gp: 1, pa_att: 30, pts: 20 });
  rows.push({ id: 'w999', week: 1, team: 'X', gp: 1, pts: 0 }); // no opportunity: excluded from the fit

  it('fits one model per position with enough rows and leaves the others null', () => {
    const coef = fitXfpCoefficients(rows, posOf);
    expect(coef.QB).toBeNull();
    expect(coef.RB).toBeNull();
    const wr = coef.WR!;
    expect(wr).toHaveLength(1 + XFP_FEATURES.WR.length);
    expect(wr[0]).toBeCloseTo(1, 4);
    expect(wr[1]).toBeCloseTo(1.5, 4);
    expect(wr[2]).toBeCloseTo(0.05, 4);
    expect(wr[3]).toBeCloseTo(2, 4);
    expect(wr[4]).toBe(0);
    expect(XFP_MIN_ROWS).toBe(50);
  });
  it('predicts from the features, treating missing ones as 0, and returns null without a model', () => {
    const coef = fitXfpCoefficients(rows, posOf);
    expect(predictXfp(coef.WR, 'WR', { id: 'w', week: 1, team: 'X', gp: 1, re_tgt: 4, re_air: 40, re_rz: 1 })).toBeCloseTo(1 + 6 + 2 + 2, 2);
    expect(predictXfp(coef.WR, 'WR', { id: 'w', week: 1, team: 'X', gp: 1 })).toBeCloseTo(1, 2);
    expect(predictXfp(null, 'QB', { id: 'q', week: 1, team: 'X', gp: 1 })).toBeNull();
    expect(xfpFeatures('QB', { id: 'q', week: 1, team: 'X', gp: 1, pa_att: 30, ru_att: 5 })).toEqual([1, 30, 0, 0, 5, 0]);
  });
});
