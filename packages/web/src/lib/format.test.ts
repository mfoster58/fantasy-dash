import { describe, it, expect } from 'vitest';
import { fmtPts, fmtPpg, fmtPct, fmtWinPct, fmtRecord, fmtSigned } from './format';

describe('format helpers', () => {
  it('formats points, ppg and percents', () => {
    expect(fmtPts(111.7)).toBe('111.70');
    expect(fmtPpg(93.333)).toBe('93.3');
    expect(fmtPct(0.9272)).toBe('92.7%');
    expect(fmtPct(0.9272, 0)).toBe('93%');
  });
  it('formats win pct without leading zero', () => {
    expect(fmtWinPct(0.6667)).toBe('.667');
    expect(fmtWinPct(1)).toBe('1.000');
    expect(fmtWinPct(0)).toBe('.000');
  });
  it('formats records and signed numbers', () => {
    expect(fmtRecord({ w: 5, l: 3, t: 0 })).toBe('5-3');
    expect(fmtRecord({ w: 5, l: 3, t: 1 })).toBe('5-3-1');
    expect(fmtSigned(4.25)).toBe('+4.3');
    expect(fmtSigned(-2)).toBe('-2.0');
    expect(fmtSigned(0)).toBe('0.0');
    expect(fmtSigned(1.234, 2)).toBe('+1.23');
  });
});
