import { describe, it, expect } from 'vitest';
import type { PlayerLine } from './playerLines';
import { fitXfp, MIN_FIT_LINES } from './xfp';

const base: PlayerLine = {
  playerId: 'p', userId: 'a', year: 2025, week: 1, gameId: '2025-1-1', matchupId: 1, tag: null, started: true,
  points: 0, yards: 0, touchdowns: 0, receptions: 0, played: true, postseason: false, consolation: false, position: 'RB', result: 'W', bye: false,
  targets: 0, carries: 0, passAttempts: 0, rushYards: 0, recYards: 0, passYards: 0, rushTd: 0, recTd: 0, passTd: 0,
};
const rb = (i: number): PlayerLine => {
  const targets = i % 7; const carries = (i * 3) % 11;
  return { ...base, playerId: `rb${i}`, week: (i % 17) + 1, targets, carries, points: 2 + 1.5 * targets + 0.6 * carries };
};
const qb = (i: number): PlayerLine => {
  const passAttempts = 20 + (i % 13); const carries = i % 5;
  return { ...base, playerId: `qb${i}`, position: 'QB', passAttempts, carries, points: 1 + 0.5 * passAttempts + 0.8 * carries };
};

describe('fitXfp', () => {
  const lines = [...Array.from({ length: 30 }, (_, i) => rb(i)), ...Array.from({ length: 30 }, (_, i) => qb(i))];
  const model = fitXfp(lines);

  it('recovers an exact linear relationship per position, dropping all-zero predictors', () => {
    expect(model.coef.RB!.map((c) => +c.toFixed(6))).toEqual([2, 1.5, 0.6, 0]);      // RB pass attempts all zero → coefficient 0
    expect(model.coef.QB!.map((c) => +c.toFixed(6))).toEqual([1, 0, 0.8, 0.5]);      // QB targets all zero → coefficient 0
    expect(model.predict({ ...base, targets: 4, carries: 10 })).toBeCloseTo(2 + 6 + 6, 6);
    expect(model.predict({ ...base, position: 'QB', passAttempts: 30, carries: 2 })).toBeCloseTo(1 + 15 + 1.6, 6);
  });

  it('ignores unplayed lines when fitting', () => {
    const noisy = [...lines, { ...base, playerId: 'ghost', played: false, points: 999 }];
    expect(fitXfp(noisy).coef.RB!.map((c) => +c.toFixed(6))).toEqual([2, 1.5, 0.6, 0]);
  });

  it('has no model for a position with too few lines, or for K, DEF and unknown positions', () => {
    const few = fitXfp(Array.from({ length: MIN_FIT_LINES - 1 }, (_, i) => rb(i)));
    expect(few.coef.RB).toBeNull();
    expect(few.predict(rb(1))).toBeNull();
    expect(model.coef.WR).toBeNull();
    expect(model.predict({ ...base, position: 'K' })).toBeNull();
    expect(model.predict({ ...base, position: 'DEF' })).toBeNull();
    expect(model.predict({ ...base, position: '?' })).toBeNull();
  });

  it('rounds predictions to two decimals', () => {
    expect(model.predict({ ...base, targets: 1, carries: 1 })).toBe(4.1);
  });
});
