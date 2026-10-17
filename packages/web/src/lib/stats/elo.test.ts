import { ELO_START, eloFor, eloHistory, eloShift, expectedScore } from './elo';
import { league, season2025 } from '../../test/statsFixtures';

describe('Elo maths', () => {
  it('expects a coin flip between equals and favours the higher rating', () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
    expect(expectedScore(1600, 1500)).toBeCloseTo(0.64, 2);
  });
  it('scales the move by the margin, capped at double, and moves nobody for an even tie', () => {
    expect(eloShift(1500, 1500, 20, 1)).toBe(24);   // K = 32 × 1.5
    expect(eloShift(1500, 1500, 60, 1)).toBe(32);   // K capped at 64
    expect(eloShift(1500, 1500, 0, 0.5)).toBe(0);
    expect(eloShift(1500, 1500, 20, 0)).toBe(-24);
  });
});

describe('eloHistory', () => {
  const h = eloHistory(league());
  const of = (id: string) => h.series.find((s) => s.id === id)!.ratings;
  it('records one point per played week across the seasons, playoff weeks flagged', () => {
    expect(h.points.map((p) => `${p.year}-${p.week}${p.playoff ? 'P' : ''}`)).toEqual(['2024-1', '2024-2', '2025-1', '2025-2', '2025-3', '2025-4', '2025-5P']);
  });
  it('walks every game: after 2024 the ratings are a 1500, b 1512, c 1540, d 1448', () => {
    expect(of('a')[1]).toBe(1500);
    expect(of('b')[1]).toBe(1512);
    expect(of('c')[1]).toBe(1540);
    expect(of('d')[1]).toBe(1448);
  });
  it('pulls everyone a third of the way back to 1500 between seasons, then keeps going', () => {
    // b enters 2025 at 1508, a at 1500; a beats b by 20 in week 1
    const ea = expectedScore(1500, 1508);
    expect(of('a')[2]).toBeCloseTo(1500 + 48 * (1 - ea), 6);
    expect(of('b')[2]).toBeCloseTo(1508 - 48 * (1 - ea), 6);
  });
  it('starts a manager who joins later at 1500 and leaves his earlier points empty', () => {
    const s = season2025();
    s.managers = { ...s.managers, e: { userId: 'e', displayName: 'eve', teamName: null, avatar: null, rosterId: 5 } };
    const late = eloHistory([league()[0], s]);
    const e = late.series.find((x) => x.id === 'e')!.ratings;
    expect(e.slice(0, 2)).toEqual([null, null]);
    expect(e[2]).toBe(ELO_START);
  });
});

describe('eloFor', () => {
  it('keeps everything for all-time and slices one season, ratings carried in', () => {
    const h = eloHistory(league());
    expect(eloFor(h, 'all')).toBe(h);
    const one = eloFor(h, 2025);
    expect(one.points.map((p) => p.week)).toEqual([1, 2, 3, 4, 5]);
    expect(one.series.find((s) => s.id === 'a')!.ratings[0]).toBe(h.series.find((s) => s.id === 'a')!.ratings[2]);
  });
});
