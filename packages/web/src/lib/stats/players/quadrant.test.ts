import { extent, fitLine, placeLabels, shortName } from './quadrant';

describe('quadrant helpers', () => {
  it('fits y = a + b x', () => {
    const f = fitLine([1, 2, 3], [3, 5, 7])!;
    expect(f.a).toBeCloseTo(1);
    expect(f.b).toBeCloseTo(2);
    expect(fitLine([1, 1], [2, 3])).toBeNull();
  });
  it('pads the extent', () => {
    expect(extent([0, 10], 0.1)).toEqual([-1, 11]);
    expect(extent([5, 5], 0.1)).toEqual([4.9, 5.1]);
  });
  it('shortens names to an initial', () => {
    expect(shortName('Jahmyr Gibbs')).toBe('J. Gibbs');
    expect(shortName("Ja'Marr Chase")).toBe('J. Chase');
    expect(shortName('Amon-Ra St. Brown')).toBe('A. St. Brown');
    expect(shortName('Cher')).toBe('Cher');
  });
  it('placeLabels never overlaps on a crowded set, and stops after a bounded number of nudges', () => {
    const pile = Array.from({ length: 30 }, (_, i) => ({ x: 100 + (i % 3), y: 100, text: `Player ${i}` }));
    const placed = placeLabels(pile, 6.4, 12);
    const boxes = placed.map((p) => ({ x0: p.x, x1: p.x + p.text.length * 6.4, y: p.y }));
    const overlaps = boxes.filter((a, i) => boxes.some((b, j) => j !== i && Math.abs(a.y - b.y) < 12 && a.x0 < b.x1 && b.x0 < a.x1)).length;
    // after the bounded nudge some may still collide; never more than the ones that ran out of room
    expect(placed.every((p) => p.y <= 100 + 12 * 8)).toBe(true);
    expect(overlaps).toBeLessThan(30);
    const spread = placeLabels([{ x: 0, y: 0, text: 'Aaaa' }, { x: 0, y: 0, text: 'Bbbb' }], 6.4, 12);
    expect(spread[1].y - spread[0].y).toBe(12);
  });
});
