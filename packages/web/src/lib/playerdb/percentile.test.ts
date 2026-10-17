import { TINT_STRENGTH, percentiles, tintFor } from './percentile';

describe('percentiles', () => {
  it('ranks from 0 to 1, averaging ties and skipping nulls', () => {
    expect(percentiles([10, 30, 20, null])).toEqual([0, 1, 0.5, null]);
    expect(percentiles([5, 5, 1])).toEqual([0.75, 0.75, 0]);
    expect(percentiles([7])).toEqual([0.5]);
    expect(percentiles([])).toEqual([]);
  });
});

describe('tintFor', () => {
  it('is transparent at the midpoint and for null, green above, red below, reversed for lower-is-better', () => {
    expect(tintFor(null)).toBe('transparent');
    expect(tintFor(0.5)).toBe('transparent');
    expect(tintFor(1)).toBe(`color-mix(in srgb, var(--win) ${TINT_STRENGTH}%, transparent)`);
    expect(tintFor(0)).toBe(`color-mix(in srgb, var(--loss) ${TINT_STRENGTH}%, transparent)`);
    expect(tintFor(0.75)).toBe(`color-mix(in srgb, var(--win) ${TINT_STRENGTH / 2}%, transparent)`);
    expect(tintFor(1, true)).toBe(`color-mix(in srgb, var(--loss) ${TINT_STRENGTH}%, transparent)`);
  });
});
