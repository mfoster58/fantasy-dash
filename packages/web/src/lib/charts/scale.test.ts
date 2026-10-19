import { chipInk, fmtDec1, fmtPct, fmtSigned, heatColor, ordinal, pctColor } from './scale';

describe('chart scale', () => {
  it('heat steps through the four heat tokens and caps at the max', () => {
    expect(heatColor(0, 0.2)).toBe('var(--heat-0)');
    expect(heatColor(0.2, 0.2)).toBe('var(--heat-3)');
    expect(heatColor(0.5, 0.2)).toBe('var(--heat-3)');
    expect(heatColor(0.1, 0.2)).toBe('color-mix(in srgb, var(--heat-2) 50%, var(--heat-1))');
  });
  it('percentile colour runs loss → warn → win and greys an unranked item', () => {
    expect(pctColor(null)).toBe('var(--dim)');
    expect(pctColor(0)).toBe('var(--loss)');
    expect(pctColor(50)).toBe('var(--warn)');
    expect(pctColor(100)).toBe('var(--win)');
    expect(pctColor(25)).toBe('color-mix(in oklch, var(--warn) 50%, var(--loss))');
    expect(pctColor(75)).toBe('color-mix(in oklch, var(--win) 50%, var(--warn))');
  });
  it('heat chips take the theme low and high heat ink (the scale runs muted to bright), pct chips the on-chip token', () => {
    expect(chipInk('heat', 0.05)).toBe('var(--heat-ink-low)');
    expect(chipInk('heat', 0.15)).toBe('var(--heat-ink-high)');
    expect(chipInk('pct')).toBe('var(--on-chip)');
  });
  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 92, 100].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '92nd', '100th']);
  });
  it('formats, never printing -0.00', () => {
    expect(fmtPct(0.153)).toBe('15%');
    expect(fmtDec1(14.18)).toBe('14.2');
    expect(fmtSigned(0.314, 2)).toBe('+0.31');
    expect(fmtSigned(-0.004, 2)).toBe('+0.00');
    expect(fmtSigned(-0.5, 2)).toBe('-0.50');
    expect(fmtSigned(3.24, 1)).toBe('+3.2');
  });
});
