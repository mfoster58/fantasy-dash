import { formGuide, scoringCalendar, standingsRace, weeklyFinishes } from './season';
import { league, season2025 } from '../../test/statsFixtures';
import { game, side, week } from '../../test/playerFixtures';

const s25 = season2025();
const row = <T extends { id: string }>(rows: T[], id: string) => rows.find((r) => r.id === id)!;

describe('standingsRace', () => {
  it('ranks by wins then points after every regular-season week', () => {
    const r = standingsRace(s25);
    expect(r.weeks).toEqual([1, 2, 3, 4]);
    expect(r.playoffTeams).toBe(2);
    expect(row(r.series, 'a').ranks).toEqual([1, 1, 1, 1]);
    expect(row(r.series, 'b').ranks).toEqual([3, 3, 2, 2]);
    expect(row(r.series, 'c').ranks).toEqual([4, 4, 4, 3]);
    expect(row(r.series, 'd').ranks).toEqual([2, 2, 3, 4]);
  });
});

describe('formGuide', () => {
  it('lists every played week, flags the playoffs and marks the week\'s top score', () => {
    const f = formGuide(s25);
    expect(f.weeks).toEqual([{ week: 1, playoff: false }, { week: 2, playoff: false }, { week: 3, playoff: false }, { week: 4, playoff: false }, { week: 5, playoff: true }]);
    expect(f.playoffAt).toBe(4);
    expect(row(f.rows, 'a').cells[0]).toEqual({ week: 1, points: 120, oppId: 'b', oppPoints: 100, result: 'W', matchupId: 1, top: true });
    expect(row(f.rows, 'd').cells.map((c) => c!.result)).toEqual(['W', 'L', 'L', 'L', 'L']);
    expect(f.rows.map((r) => r.cells.filter((c) => c!.top).length)).toEqual([3, 1, 1, 0]);
  });
  it('shows a tie as T and leaves a cell empty for a week without a game', () => {
    const s = season2025();
    s.weeks = [week(1, [game(2025, 1, 1, side('a', 100, []), side('b', 100, []))])];
    const f = formGuide(s);
    expect(row(f.rows, 'a').cells[0]!.result).toBe('T');
    expect(row(f.rows, 'c').cells[0]).toBeNull();
    expect(f.playoffAt).toBeNull();
  });
});

describe('scoringCalendar', () => {
  it('compares every regular-season score with that week\'s league average', () => {
    const c = scoringCalendar(s25);
    expect(c.weeks).toEqual([1, 2, 3, 4]);
    expect(row(c.rows, 'a').cells.map((x) => [x!.points, x!.avg, x!.delta])).toEqual([[120, 105, 15], [130, 113.75, 16.25], [80, 98.75, -18.75], [100, 97.25, 2.75]]);
  });
});

describe('weeklyFinishes', () => {
  it('counts top-three and bottom weeks over one season, sorted by the top count', () => {
    const f = weeklyFinishes([s25]);
    expect(f.map((r) => [r.id, r.top, r.middle, r.bottom, r.weeks])).toEqual([['a', 4, 0, 0, 4], ['b', 4, 0, 0, 4], ['c', 2, 0, 2, 4], ['d', 2, 0, 2, 4]]);
  });
  it('adds up across seasons', () => {
    const f = weeklyFinishes(league());
    expect(row(f, 'a')).toEqual({ id: 'a', top: 6, middle: 0, bottom: 0, weeks: 6 });
    expect(row(f, 'd')).toEqual({ id: 'd', top: 2, middle: 0, bottom: 4, weeks: 6 });
  });
});
