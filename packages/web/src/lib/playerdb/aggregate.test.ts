import { aggregate, aggregateWeeks } from './aggregate';
import { miniDb } from '../../test/playerDbFixtures';

const byId = (from: number, to: number) => Object.fromEntries(aggregate(miniDb(), from, to).map((a) => [a.id, a]));

describe('aggregate', () => {
  it('sums counting stats over the range and counts played games and weeks', () => {
    const w1 = byId(1, 3).w1;
    expect(w1.games).toBe(3);
    expect(w1.weeks).toBe(3);
    expect(w1.s.re_tgt).toBe(26);
    expect(w1.s.re_yds).toBe(250);
    expect(w1.s.pts).toBe(50);
    expect(w1.routes).toBe(97);
    expect(w1.routesEst).toBe(true);
    expect(w1.team).toBe('KC');
  });
  it('narrows to the range, keeping the week count for minimums', () => {
    const w2 = byId(2, 3).w2;
    expect(w2.games).toBe(1);
    expect(w2.weeks).toBe(2);
    expect(w2.s.re_tgt).toBe(6);
    expect(byId(3, 3)).not.toHaveProperty('w2');
  });
  it('weights NGS averages by targets over the weeks that have them, never NaN', () => {
    const w1 = byId(1, 3).w1;
    expect(w1.w.re_sep).toBeCloseTo((3 * 9 + 2 * 7) / 16, 6);
    expect(byId(1, 3).w2.w.re_sep).toBeUndefined();
    expect(byId(3, 3).w1.w.re_sep).toBeUndefined();
  });
  it('sums team totals from the player\'s own team-weeks across a trade', () => {
    const w1 = byId(1, 3).w1;
    expect(w1.t.passAtt).toBe(30 + 30 + 40);
    expect(w1.t.dropbacks).toBe(32 + 32 + 42);
    expect(w1.t.airYds).toBe(240 + 240 + 300);
  });
  it('tracks projection difference over weeks with a projection and ranks by points within position', () => {
    const a = byId(1, 3);
    expect(a.w1.projDiff).toBeCloseTo((18.5 - 14) + (11.5 - 15) + (20 - 13), 6);
    expect(a.r1.projDiff).toBeNull();
    expect(a.w1.posRank).toBe(1);
    expect(a.w2.posRank).toBe(2);
    expect(a.r1.posRank).toBe(1);
    expect(a.t1.posRank).toBe(1);
  });
  it('uses real routes when the database has them', () => {
    const db = miniDb();
    db.routesReal = true;
    db.rows = db.rows.map((r) => ({ ...r, routes: r.routesEst === undefined ? undefined : r.routesEst + 1, routesEst: undefined }));
    const w1 = aggregate(db, 1, 3).find((a) => a.id === 'w1')!;
    expect(w1.routes).toBe(100);
    expect(w1.routesEst).toBe(false);
  });
  it('aggregateWeeks builds a one-week aggregate for a nested row', () => {
    const db = miniDb();
    const a = aggregateWeeks(db, [db.rows.find((r) => r.id === 'w1' && r.week === 2)!], 1);
    expect(a).toMatchObject({ id: 'w1', games: 1, weeks: 1, team: 'TB', routes: 29 });
    expect(a.s.re_tgt).toBe(7);
    expect(a.t.passAtt).toBe(30);
  });
});
