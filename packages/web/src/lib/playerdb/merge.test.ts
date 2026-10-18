import { aggregate } from './aggregate';
import { aggregateAllTime, mergeSeasons, weekLabel } from './merge';
import { miniDb } from '../../test/playerDbFixtures';

const two = () => mergeSeasons([miniDb(), { ...miniDb(), year: 2025, routesReal: true }]);
const byId = <T extends { id: string }>(xs: T[]) => Object.fromEntries(xs.map((x) => [x.id, x]));

describe('mergeSeasons', () => {
  it('lays the seasons end to end, oldest first, keeping each week traceable to its season', () => {
    const m = two();
    expect(m.spans).toEqual([{ year: 2025, offset: 0, weeks: 3 }, { year: 2026, offset: 3, weeks: 3 }]);
    expect(m.db.throughWeek).toBe(6);
    expect(m.db.year).toBe(2026);
    expect(weekLabel(m.spans, 4)).toEqual({ year: 2026, week: 1 });
    expect(weekLabel(m.spans, 3)).toEqual({ year: 2025, week: 3 });
  });
  it('sums a player over every season and keeps team totals from each season apart', () => {
    const one = byId(aggregate(miniDb(), 1, 3));
    const all = byId(aggregateAllTime(two()));
    expect(all.w1.games).toBe(one.w1.games * 2);
    expect(all.w1.s.pts).toBe(one.w1.s.pts! * 2);
    expect(all.w1.t.passAtt).toBe(one.w1.t.passAtt * 2);
    expect(all.w1.w.re_sep).toBeCloseTo(one.w1.w.re_sep!, 6);
  });
  it('uses real routes for a season that has them and estimates for one that does not', () => {
    const est = byId(aggregate(miniDb(), 1, 3)).w1;
    const real = byId(aggregate({ ...miniDb(), routesReal: true }, 1, 3)).w1;
    const all = byId(aggregateAllTime(two())).w1;
    expect(all.routes).toBe(est.routes + real.routes);
    expect(all.routesEst).toBe(true);
  });
  it('scales sample minimums by the weeks of the seasons a player appears in', () => {
    const older = { ...miniDb(), year: 2025, rows: miniDb().rows.filter((r) => r.id !== 'w2') };
    const all = byId(aggregateAllTime(mergeSeasons([older, miniDb()])));
    expect(all.w1.weeks).toBe(6);
    expect(all.w2.weeks).toBe(3);
  });
});
