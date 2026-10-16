import { describe, it, expect } from 'vitest';
import { bracketGame, game, line, season, side, standing, week } from '../test/playerFixtures';
import { managerSeasonsOf, teamGamesOf } from './managerGames';

const s2024 = {
  ...season(2024, [
    week(1, [game(2024, 1, 1, side('a', 120, [line('q1', 30)]), side('b', 90, [line('r1', 10)]))]),
    week(2, [game(2024, 2, 1, side('a', 80, [line('q1', 10)]), side('b', 80, [line('r1', 10)]))]),
    week(3, [game(2024, 3, 1, side('a', 150, [line('q1', 50)]), side('b', 60, [line('r1', 5)]), 'Final')], true),
  ], 'a'),
  standings: [standing('a', 1, 1, 0, 1, 200, 170), standing('b', 2, 0, 1, 1, 170, 200)],
  honors: { champion: 'a', runnerUp: 'b', third: null, pointsTitle: 'a', lastPlace: 'b' },
};
s2024.brackets = { winners: [bracketGame('a', 'b', 'Final', 3)], consolation: [] };
s2024.weeks[0].highScore = 'a';
const s2025 = { ...season(2025, [week(1, [game(2025, 1, 1, side('b', 100, [line('r1', 10)]), side('a', 70, [line('q1', 10)]))])], null, 1), status: 'in_season' as const, standings: [standing('b', 1, 1, 0, 0, 100, 70), standing('a', 2, 0, 1, 0, 70, 100)] };

describe('teamGamesOf', () => {
  const games = teamGamesOf([s2024, s2025]);
  it('yields one row per side per played game with result, bench points and tags', () => {
    expect(games).toHaveLength(8);
    const a1 = games.find((g) => g.year === 2024 && g.week === 1 && g.userId === 'a')!;
    expect(a1).toMatchObject({ opponentId: 'b', points: 120, oppPoints: 90, result: 'W', ceiling: 130, benchPoints: 10, isPlayoff: false, postseason: false, consolation: false, weekHigh: true, gameId: '2024-1-1', matchupId: 1, tag: null });
    expect(games.find((g) => g.year === 2024 && g.week === 2 && g.userId === 'b')!.result).toBe('T');
    expect(games.find((g) => g.year === 2024 && g.week === 3 && g.userId === 'b')).toMatchObject({ result: 'L', isPlayoff: true, postseason: true, tag: 'Final', weekHigh: false });
  });
  it('skips unplayed weeks', () => {
    expect(teamGamesOf([{ ...s2025, weeks: [week(1, [])] }])).toEqual([]);
  });
});

describe('managerSeasonsOf', () => {
  const games = teamGamesOf([s2024, s2025]);
  const ms = managerSeasonsOf([s2024, s2025], games);
  it('builds one row per standings row with honors, berth, seed, bench points and completeness', () => {
    expect(ms).toHaveLength(4);
    expect(ms.find((m) => m.year === 2024 && m.userId === 'a')).toMatchObject({ complete: true, games: 2, benchPoints: 30, champion: true, runnerUp: false, lastPlace: false, playoffBerth: true, seed: 1 });
    expect(ms.find((m) => m.year === 2024 && m.userId === 'b')).toMatchObject({ champion: false, runnerUp: true, lastPlace: true, playoffBerth: true, seed: 2 });
    expect(ms.find((m) => m.year === 2025 && m.userId === 'a')).toMatchObject({ complete: false, games: 1, playoffBerth: false, benchPoints: 10 });
  });
  it('returns nothing for a season without standings', () => {
    expect(managerSeasonsOf([{ ...s2025, standings: [] }], games)).toEqual([]);
  });
});
