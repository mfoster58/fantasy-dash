import { percentiles, tintFor } from './percentile';
import { VALUE_SATURATION, valueColor } from '../draft';

describe('percentiles', () => {
  it('ranks from 0 to 1, averaging ties and skipping nulls', () => {
    expect(percentiles([10, 30, 20, null])).toEqual([0, 1, 0.5, null]);
    expect(percentiles([5, 5, 1])).toEqual([0.75, 0.75, 0]);
    expect(percentiles([7])).toEqual([0.5]);
    expect(percentiles([])).toEqual([]);
  });
});

describe('tintFor', () => {
  it('uses the draft board red-yellow-green scale: yellow at the midpoint, green above, red below, reversed for lower-is-better', () => {
    expect(tintFor(null)).toBe('transparent');
    expect(tintFor(0.5)).toBe(valueColor(0));
    expect(tintFor(1)).toBe(valueColor(VALUE_SATURATION));
    expect(tintFor(0)).toBe(valueColor(-VALUE_SATURATION));
    expect(tintFor(0.75)).toBe(valueColor(VALUE_SATURATION / 2));
    expect(tintFor(1, true)).toBe(valueColor(-VALUE_SATURATION));
    expect(tintFor(1)).toContain('#2f9e5f');
    expect(tintFor(0)).toContain('#d64545');
    expect(tintFor(0.5)).toContain('#e6c229');
  });
});
