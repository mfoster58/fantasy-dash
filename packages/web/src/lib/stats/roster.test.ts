import { draftReturns, pointOrigins, rosterAge, wireActivity } from './roster';
import { league, season2024, season2025, statsPlayers } from '../../test/statsFixtures';
import { game, side, week } from '../../test/playerFixtures';

const row = <T extends { id: string }>(rows: T[], id: string) => rows.find((r) => r.id === id)!;

describe('draftReturns', () => {
  it('sums the started points each round\'s pick produced for the drafter, nothing after a drop, nothing for an undrafted starter', () => {
    const d = draftReturns(season2025())!;
    expect(d.rounds).toBe(2);
    expect(d.rows.map((r) => [r.id, r.total])).toEqual([['b', 507], ['a', 340], ['d', 222], ['c', 185]]);
    expect(row(d.rows, 'a').cells).toEqual([{ round: 1, playerId: 'q1', points: 340 }, { round: 2, playerId: 't2', points: 0 }]);
    expect(row(d.rows, 'b').cells[1]).toEqual({ round: 2, playerId: 'w2', points: 0 });
  });
  it('is null without a draft', () => { expect(draftReturns(season2024())).toBeNull(); });
});

describe('pointOrigins', () => {
  it('splits started points by draft, pickups and trades, wire-workers first', () => {
    const o = pointOrigins([season2025()]);
    expect(o.map((r) => r.id)).toEqual(['c', 'd', 'a', 'b']);
    expect(row(o, 'a')).toEqual({ id: 'a', draft: 340, pickup: 120, trade: 0, other: 120, total: 580 });
    expect(row(o, 'c')).toEqual({ id: 'c', draft: 185, pickup: 0, trade: 325, other: 0, total: 510 });
  });
  it('calls points of unknown origin "other" and adds seasons up', () => {
    expect(row(pointOrigins([season2024()]), 'a')).toEqual({ id: 'a', draft: 0, pickup: 0, trade: 0, other: 190, total: 190 });
    expect(row(pointOrigins(league()), 'a').total).toBe(770);
  });
});

describe('rosterAge', () => {
  it('weights each player\'s age at 1 September by his started points, youngest manager first', () => {
    const r = rosterAge([season2025()], statsPlayers);
    expect(r.rows.map((x) => x.id)).toEqual(['a', 'd', 'c', 'b']);
    expect(row(r.rows, 'b').age).toBeCloseTo(29.22, 2);   // r1 turns 30 the day after the cut-off; x2 is estimated at 32
    expect(row(r.rows, 'b').estimated).toBe(true);
    expect(row(r.rows, 'c').estimated).toBe(false);
    expect(row(r.rows, 'a').rookieShare).toBeCloseTo(90 / 580, 4);
    expect(row(r.rows, 'a').vetShare).toBeCloseTo(30 / 580, 4);
    expect(r.estimated).toBe(true);
  });
  it('skips a player with neither a birth date nor an experience count, and a manager with nothing datable', () => {
    const s = season2025();
    s.weeks = [week(1, [game(2025, 1, 1, side('a', 50, [{ playerId: 'zz', points: 50, projected: null, stats: {} }]), side('b', 10, [{ playerId: 'q1', points: 10, projected: null, stats: {} }]))])];
    const r = rosterAge([s], statsPlayers);
    expect(r.rows.map((x) => [x.id, x.age])).toEqual([['b', 26]]);
    expect(r.estimated).toBe(false);
  });
});

describe('wireActivity', () => {
  it('counts pickups per played week with the season total and FAAB spent, busiest first', () => {
    const w = wireActivity(season2025());
    expect(w.weeks).toEqual([1, 2, 3, 4, 5]);
    expect(w.rows.map((r) => [r.id, r.total, r.faab])).toEqual([['a', 2, 13], ['b', 1, 0], ['c', 0, 0], ['d', 0, 0]]);
    expect(row(w.rows, 'a').perWeek).toEqual([0, 1, 0, 1, 0]);
  });
});
