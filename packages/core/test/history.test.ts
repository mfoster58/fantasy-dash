import { describe, it, expect } from 'vitest';
import { buildSeason } from '../src/season';
import { buildHistory, summarizeSeries } from '../src/history';
import type { H2HSeries } from '../src/types';
import { miniInput } from './fixtures/mini';

describe('buildHistory', () => {
  const s2024 = buildSeason(miniInput());
  const later = miniInput();
  later.league.season = '2025';
  later.league.league_id = 'L2025';
  later.users[0].display_name = 'Alice II';
  const s2025 = buildSeason(later);
  const history = buildHistory([s2025, s2024]);

  it('lists seasons oldest first', () => {
    expect(history.seasons).toEqual([
      { year: 2024, leagueId: 'L2024', status: 'complete', lastScoredWeek: 3, playoffWeekStart: 4 },
      { year: 2025, leagueId: 'L2025', status: 'complete', lastScoredWeek: 3, playoffWeekStart: 4 },
    ]);
  });

  it('collects managers with the latest display name and their seasons', () => {
    expect(history.managers.ua).toEqual({ displayName: 'Alice II', avatar: null, seasons: [2024, 2025] });
    expect(Object.keys(history.managers)).toHaveLength(4);
  });

  it('accumulates head-to-head series with games newest first', () => {
    const ab = history.h2h['ua|ub'];
    expect(ab).toMatchObject({ a: 'ua', b: 'ub', aWins: 2, bWins: 0, ties: 0 });
    expect(ab.games).toEqual([
      { gameId: '2025-1-1', year: 2025, week: 1, tag: null, aPoints: 100, bPoints: 90 },
      { gameId: '2024-1-1', year: 2024, week: 1, tag: null, aPoints: 100, bPoints: 90 },
    ]);
    expect(history.h2h['ub|ud']).toMatchObject({ aWins: 0, bWins: 0, ties: 2 });
  });

  it('ignores unplayed games', () => {
    const input = miniInput();
    input.league.status = 'in_season';
    input.league.settings.last_scored_leg = 1;
    const h = buildHistory([buildSeason(input)]);
    expect(h.h2h['ua|ub'].games).toHaveLength(1);
    expect(h.h2h['ua|uc']).toBeUndefined();
  });
});

function seriesWith(games: [number, number, number, number][]): H2HSeries {
  // [year, week, aPoints, bPoints], any order; summarizeSeries expects newest first
  const sorted = [...games].sort((p, q) => q[0] - p[0] || q[1] - p[1]);
  return {
    a: 'ua', b: 'ub', aWins: 0, bWins: 0, ties: 0,
    streak: { holder: null, length: 0 }, totalPoints: { a: 0, b: 0 }, biggestWin: null, closest: null, avgMargin: 0,
    games: sorted.map(([year, week, aPoints, bPoints]) => ({ gameId: `${year}-${week}-1`, year, week, tag: null, aPoints, bPoints })),
  };
}

describe('summarizeSeries', () => {
  it('computes streak, totals, biggest win, closest and average margin', () => {
    const s = summarizeSeries(seriesWith([
      [2024, 1, 100, 90],   // a by 10
      [2024, 5, 80, 120],   // b by 40
      [2025, 2, 110, 100],  // a by 10
      [2025, 9, 131.5, 130], // a by 1.5  (newest)
    ]));
    expect(s.streak).toEqual({ holder: 'ua', length: 2 });
    expect(s.totalPoints).toEqual({ a: 421.5, b: 440 });
    expect(s.biggestWin).toEqual({ gameId: '2024-5-1', winner: 'ub', margin: 40 });
    expect(s.closest).toEqual({ gameId: '2025-9-1', margin: 1.5 });
    expect(s.avgMargin).toBe(15.38);
  });

  it('treats a tie as the closest game and breaks the streak', () => {
    const s = summarizeSeries(seriesWith([[2024, 1, 100, 90], [2024, 3, 100, 100]]));
    expect(s.streak).toEqual({ holder: null, length: 0 });
    expect(s.closest).toEqual({ gameId: '2024-3-1', margin: 0 });
    expect(s.biggestWin).toEqual({ gameId: '2024-1-1', winner: 'ua', margin: 10 });
  });

  it('handles an empty series', () => {
    const s = summarizeSeries(seriesWith([]));
    expect(s.streak).toEqual({ holder: null, length: 0 });
    expect(s.biggestWin).toBeNull();
    expect(s.closest).toBeNull();
    expect(s.avgMargin).toBe(0);
  });

  it('is applied by buildHistory', () => {
    const h = buildHistory([buildSeason(miniInput())]);
    expect(h.h2h['ua|ub'].streak).toEqual({ holder: 'ua', length: 1 });
    expect(h.h2h['ua|ub'].totalPoints).toEqual({ a: 100, b: 90 });
    expect(h.h2h['ub|ud'].closest).toEqual({ gameId: '2024-2-2', margin: 0 });
  });
});
