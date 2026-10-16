import { describe, it, expect } from 'vitest';
import type { History } from '@fantasy-dash/core';
import { bracketGame, game, line, players, season, side, standing, week } from '../../../test/playerFixtures';
import { managerSeasonsOf, teamGamesOf } from '../../managerGames';
import type { BoardContext } from '../shared';
import { careerMeta, careerRows, gameRows, matchups, seasonRows, seasonScope } from './shared';

export const managers: History['managers'] = { a: { displayName: 'alice', avatar: null, seasons: [2024, 2025] }, b: { displayName: 'bob', avatar: null, seasons: [2024, 2025] } };
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
export const seasons = [s2024, s2025];
const teamGames = teamGamesOf(seasons);
const managerSeasons = managerSeasonsOf(seasons, teamGames);
export const mctx = (year: number | null = null): BoardContext => ({
  lines: [], players, champions: {}, lastPlaces: {}, year, currentYear: 2025, pos: 'All', picks: [], xfp: null, transactions: [], playerSeasons: {}, drafts: {},
  managers, teamGames: teamGames.filter((g) => year === null || g.year === year), managerSeasons: managerSeasons.filter((m) => year === null || m.year === year),
});

describe('manager board helpers', () => {
  it('careerRows aggregates every season and game per manager, drops nulls, and labels the span', () => {
    const rows = careerRows(mctx(), (a) => a.games.filter((g) => g.result === 'W').length || null, String, (a) => `${a.seasons.length} seasons`);
    expect(rows.map((r) => [r.playerId, r.userId, r.value, r.meta, r.detail])).toEqual([
      [null, 'a', 2, '2024–2025 · 2 seasons', '2 seasons'],
      [null, 'b', 1, '2024–2025 · 2 seasons', '2 seasons'],
    ]);
    expect(careerMeta([2025])).toBe('2025 · 1 season');
  });
  it('seasonScope keeps complete seasons under All-time and the chosen year otherwise', () => {
    expect(seasonScope(mctx()).map((m) => m.year)).toEqual([2024, 2024]);
    expect(seasonScope(mctx(2025)).map((m) => m.year)).toEqual([2025, 2025]);
  });
  it('seasonRows yields one row per manager-season linking to the standings', () => {
    const rows = seasonRows(mctx(), (m) => m.row.pf, (v) => v.toFixed(2), (m) => `${m.row.w}-${m.row.l}`);
    expect(rows.map((r) => [r.userId, r.value, r.meta, r.detail, r.to])).toEqual([['a', 200, '2024', '1-0', '/standings/2024'], ['b', 170, '2024', '0-1', '/standings/2024']]);
  });
  it('gameRows yields one row per team game with the opponent and score, linking to the box score', () => {
    const rows = gameRows(mctx(), mctx().teamGames, (g) => g.points, (v) => v.toFixed(2));
    expect(rows[0]).toMatchObject({ playerId: null, userId: 'a', value: 150, meta: '2024 · Wk 3 · Championship', detail: 'vs bob, 150.00–60.00', to: '/scores/2024/3/1' });
    expect(gameRows(mctx(), mctx().teamGames, (g) => g.points, String, 'asc')[0]).toMatchObject({ userId: 'b', value: 60 });
  });
  it('matchups keeps one side per game, the higher scorer, the first side on a tie', () => {
    const m = matchups(mctx(2024).teamGames);
    expect(m.map((g) => [g.week, g.userId, g.points])).toEqual([[1, 'a', 120], [2, 'a', 80], [3, 'a', 150]]);
  });
});
