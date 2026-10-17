import { byWeek, managerRefs, medianOf, regular, scopeSeasons, weekKey } from './scope';
import { teamGamesOf } from '../managerGames';
import { league, season2024, season2025 } from '../../test/statsFixtures';

describe('scopeSeasons', () => {
  it('keeps one year or every year, oldest first', () => {
    expect(scopeSeasons([season2025(), season2024()], 'all').map((s) => s.year)).toEqual([2024, 2025]);
    expect(scopeSeasons(league(), 2025).map((s) => s.year)).toEqual([2025]);
    expect(scopeSeasons(league(), 2023)).toEqual([]);
  });
});

describe('managerRefs', () => {
  it('follows the latest season\'s standings, then anyone who only played earlier, by name', () => {
    expect(managerRefs(league()).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(managerRefs(league())[1]).toEqual({ id: 'b', name: 'bob', avatar: 'img-b' });
    const old = season2024();
    old.managers = { ...old.managers, e: { userId: 'e', displayName: 'eve', teamName: null, avatar: null, rosterId: 5 } };
    expect(managerRefs([old, season2025()]).map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('is empty without seasons', () => { expect(managerRefs([])).toEqual([]); });
});

describe('helpers', () => {
  it('keys weeks, takes the median of an even and an odd list, splits the regular season and groups games by week', () => {
    expect(weekKey(2025, 3)).toBe('2025-3');
    expect(medianOf([120, 100, 90, 110])).toBe(105);
    expect(medianOf([3, 1, 2])).toBe(2);
    expect(medianOf([])).toBe(0);
    const games = teamGamesOf([season2025()]);
    expect(regular(games)).toHaveLength(16);
    const weeks = byWeek(games);
    expect(weeks.map((w) => [w.key, w.playoff, w.games.length])).toEqual([['2025-1', false, 4], ['2025-2', false, 4], ['2025-3', false, 4], ['2025-4', false, 4], ['2025-5', true, 4]]);
  });
});
