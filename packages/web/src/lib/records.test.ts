import { describe, it, expect } from 'vitest';
import type { StandingRow } from '@fantasy-dash/core';
import { seasonRecords } from './records';

const row = (userId: string, o: Partial<StandingRow>): StandingRow => ({
  userId, rank: 1, w: 7, l: 7, t: 0, winPct: 0.5, pf: 1500, pa: 1500, ppg: 107.1, maxPoints: 1700, efficiency: 0.88,
  streak: '-', allPlay: { w: 60, l: 66, t: 0, pct: 0.4762 }, weeklyHighs: 1, ...o,
});

describe('seasonRecords', () => {
  const rows = [
    row('a', { w: 10, l: 4, pf: 2061.76, ppg: 147.3, winPct: 0.7143, allPlay: { w: 82, l: 44, t: 0, pct: 0.651 }, weeklyHighs: 4 }),
    row('b', { w: 10, l: 4, pf: 2003.96, ppg: 143.1, winPct: 0.7143, allPlay: { w: 77, l: 49, t: 0, pct: 0.611 }, weeklyHighs: 5 }),
    row('c', { pf: 1600, ppg: 114.3, winPct: 0.2143, allPlay: { w: 35, l: 91, t: 0, pct: 0.278 }, weeklyHighs: 0 }),
  ];
  it('picks the leader for each record with PF as the record tiebreak', () => {
    const r = Object.fromEntries(seasonRecords(rows).map((x) => [x.key, x]));
    expect(r.mostPoints).toMatchObject({ userId: 'a', value: '2061.76' });
    expect(r.bestPpg).toMatchObject({ userId: 'a', value: '147.3' });
    expect(r.bestRecord).toMatchObject({ userId: 'a', value: '10-4' });
    expect(r.bestAllPlay).toMatchObject({ userId: 'a', value: '82-44 (.651)' });
    expect(r.mostWeeklyHighs).toMatchObject({ userId: 'b', value: '5' });
    expect(seasonRecords(rows).map((x) => x.key)).toEqual(['mostPoints', 'bestPpg', 'bestRecord', 'bestAllPlay', 'mostWeeklyHighs']);
  });
  it('returns nothing for an empty season', () => {
    expect(seasonRecords([])).toEqual([]);
  });
});
