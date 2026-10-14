import { describe, it, expect } from 'vitest';
import { scoreStats, round2, round4 } from '../src/scoring';

describe('scoreStats', () => {
  const scoring = { pass_yd: 0.04, pass_td: 4, pass_int: -1, rush_yd: 0.1, rec: 1, bonus_rec_te: 0 };

  it('multiplies each stat by its weight and sums', () => {
    expect(scoreStats({ pass_yd: 250, pass_td: 2, pass_int: 1 }, scoring)).toBe(17);
  });

  it('ignores stats with no scoring weight and weights with no stat', () => {
    expect(scoreStats({ pass_yd: 100, pos_rank_ppr: 3 }, scoring)).toBe(4);
    expect(scoreStats({}, scoring)).toBe(0);
  });

  it('rounds to 2 decimals', () => {
    expect(scoreStats({ rush_yd: 33 }, scoring)).toBe(3.3);
    expect(scoreStats({ pass_yd: 7 }, scoring)).toBe(0.28);
  });
});

describe('rounding', () => {
  it('round2 and round4', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round4(0.123456)).toBe(0.1235);
  });
});
