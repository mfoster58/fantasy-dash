import { allPlayGrid, consistency, postseasonForm, scheduleLuck, strengthOfSchedule } from './strength';
import { teamGamesOf } from '../managerGames';
import { league, season2024, season2025 } from '../../test/statsFixtures';
import { game, side, week } from '../../test/playerFixtures';

const g25 = teamGamesOf([season2025()]);
const row = <T extends { id: string }>(rows: T[], id: string) => rows.find((r) => r.id === id)!;

describe('consistency', () => {
  it('takes the floor and ceiling one week in from the extremes, sorted by median', () => {
    const c = consistency(g25);
    expect(c.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(row(c, 'a')).toEqual({ id: 'a', games: 4, min: 80, floor: 100, median: 110, ceiling: 120, max: 130 });
    expect(row(c, 'd').median).toBe(92.5);
  });
  it('uses the extremes themselves under four games', () => {
    expect(row(consistency(teamGamesOf([season2024()])), 'a')).toEqual({ id: 'a', games: 2, min: 90, floor: 90, median: 95, ceiling: 100, max: 100 });
  });
});

describe('scheduleLuck', () => {
  it('compares the real record with the record against the weekly median', () => {
    const l = scheduleLuck(g25);
    expect(l.map((r) => r.id)).toEqual(['a', 'b', 'd', 'c']);
    expect(row(l, 'a')).toEqual({ id: 'a', w: 4, l: 0, t: 0, medianW: 3, medianL: 1, delta: 1 });
    expect(row(l, 'c')).toEqual({ id: 'c', w: 1, l: 3, t: 0, medianW: 2, medianL: 2, delta: -1 });
  });
  it('counts a tie as neither, and scoring exactly the median as a median loss', () => {
    const s = season2025();
    s.weeks = [week(1, [game(2025, 1, 1, side('a', 100, []), side('b', 100, [])), game(2025, 1, 2, side('c', 90, []), side('d', 80, []))])];
    const l = scheduleLuck(teamGamesOf([s]));
    expect(row(l, 'a')).toEqual({ id: 'a', w: 0, l: 0, t: 1, medianW: 1, medianL: 0, delta: -1 });
    expect(row(l, 'c').medianW).toBe(0);
  });
});

describe('strengthOfSchedule', () => {
  it('measures opponents\' scoring against the league\'s weekly average', () => {
    const s = strengthOfSchedule(g25);
    expect(s.map((r) => r.id)).toEqual(['c', 'b', 'd', 'a']);
    expect(row(s, 'a')).toEqual({ id: 'a', faced: 92.25, leagueAvg: 103.69, delta: -11.44 });
  });
});

describe('allPlayGrid', () => {
  it('counts the weeks each manager outscored each other, with the real matchup record alongside', () => {
    const grid = allPlayGrid(g25, ['a', 'b', 'c', 'd']);
    expect(grid.ids).toEqual(['a', 'b', 'c', 'd']);
    expect(grid.cells.a.b).toEqual({ w: 3, l: 1, t: 0, realW: 2, realL: 0, realT: 0 });
    expect(grid.cells.b.a).toEqual({ w: 1, l: 3, t: 0, realW: 0, realL: 2, realT: 0 });
    expect(grid.cells.a.c).toEqual({ w: 2, l: 2, t: 0, realW: 1, realL: 0, realT: 0 });
    expect(grid.cells.a.a).toBeUndefined();
  });
});

describe('postseasonForm', () => {
  it('sets postseason scoring against the regular season for everyone who played a postseason game', () => {
    const p = postseasonForm(g25);
    expect(p.map((r) => r.id)).toEqual(['a', 'd', 'c', 'b']);
    expect(row(p, 'a')).toEqual({ id: 'a', regPpg: 107.5, postPpg: 150, postGames: 1, delta: 42.5 });
    expect(postseasonForm(teamGamesOf([season2024()]))).toEqual([]);
    expect(postseasonForm(teamGamesOf(league())).find((r) => r.id === 'a')!.regPpg).toBeCloseTo((430 + 190) / 6, 2);
  });
});
