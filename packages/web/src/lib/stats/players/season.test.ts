import { statsCharts, statsDb } from '../../../test/statsPlayersFixtures';
import { seasonStats } from './season';

const stats = seasonStats(statsDb(), statsCharts());
const by = (id: string) => stats.find((s) => s.id === id)!;

describe('seasonStats', () => {
  it('per-game averages count healthy games only', () => {
    const h = by('rHurt');               // healthy weeks 1 and 5; week 2 short; 3–4 missed
    expect(h.games).toBe(3);
    expect(h.healthy).toBe(2);
    expect(h.ppg).toBeCloseTo(((20 * 0.6 + 5 * 1.6) + (19 * 0.6 + 4 * 1.6)) / 2);
    expect(h.wopg).toBeCloseTo((20 + 19 + 1.5 * (5 + 4)) / 2);
  });
  it('rates count every game played', () => {
    const h = by('rHurt');
    expect(h.car).toBe(42);
    expect(h.ypc).toBeCloseTo(4);
  });
  it('QB: ANY/A, EPA per dropback, quarters', () => {
    const q = by('qA');
    expect(q.dropbacks).toBe(160);
    expect(q.anya).toBeCloseTo((1250 + 20 * 10 - 45 * 5 - 70) / 160);
    expect(q.epaDb).toBeCloseTo(20 / 160);
    expect(q.epa13).toBeCloseTo(0.1);
    expect(q.epa4).toBeCloseTo(0.2);
    expect(q.cpoe).toBeCloseTo(2);
  });
  it('RB play-by-play: success, explosive and red zone against league band averages', () => {
    const u = by('rUp');
    expect(u.succ).toBeCloseTo(0.5);
    expect(u.expl).toBeCloseTo(6 / 54);
    // ra league average = (8 + 6) / (4 + 6) = 1.4; rc = 3 / 6 = 0.5
    expect(u.rzX).toBeCloseTo((4 * 1.4 + 6 * 0.5) / 5);
    expect(u.rzA).toBeCloseTo((8 + 3) / 5);
  });
  it('a week range counts only those weeks, play-by-play included', () => {
    const u = seasonStats(statsDb(), statsCharts(), { from: 4, to: 5 }).find((s) => s.id === 'rUp')!;
    expect(u.games).toBe(2);
    expect(u.car).toBe(38);
    expect(u.succ).toBeCloseTo(21 / 38);
    expect(u.expl).toBeCloseTo(5 / 38);
    expect(u.rzA).toBeCloseTo(8 / 2);
  });
  it('a player with no games in the range is left out', () => {
    expect(seasonStats(statsDb(), statsCharts(), { from: 3, to: 4 }).find((s) => s.id === 'rHurt')).toBeUndefined();
  });
  it('routes fall back to the estimate and say so', () => {
    const w = by('wA');
    expect(w.routesEst).toBe(true);
    expect(w.yprr).toBeCloseTo(w.yds / w.routes);
  });
  it('participation stats are null without participation', () => {
    expect(by('qA').clean).toBeNull();
    expect(by('wA').manYpt).toBeNull();
  });
  it('uses his latest team', () => {
    const db = statsDb();
    db.rows.filter((r) => r.id === 'wA' && r.week === 5).forEach((r) => { r.team = 'BBB'; });
    expect(seasonStats(db, statsCharts()).find((s) => s.id === 'wA')!.team).toBe('BBB');
  });
  it('never yields NaN or Infinity, even with zero denominators', () => {
    const bad = JSON.stringify(stats, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? 'BAD' : v));
    expect(bad).not.toContain('BAD');
    expect(by('qA').ypt).toBeNull();     // no targets
    expect(by('wA').succ).toBeNull();    // no play-by-play rushing
  });
});
