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

import { buildAllTime } from '../src/history';
import type { Season } from '../src/types';

describe('buildAllTime', () => {
  // Two mini seasons; 2025 gets a bracket so honors and playoff counts are exercised.
  const s2024 = buildSeason(miniInput());
  const later = miniInput();
  later.league.season = '2025';
  later.league.league_id = 'L2025';
  later.league.settings.playoff_week_start = 3;
  later.league.settings.playoff_teams = 2;
  // week 3 becomes the Final: ua vs ub (ua wins 120-70? pairings are (ua,ud),(ub,uc); use ua vs ud as Final)
  later.winnersBracket = [{ r: 1, m: 1, t1: 1, t2: 4, p: 1 }];
  later.losersBracket = [{ r: 1, m: 1, t1: 2, t2: 3, p: 1 }];
  const s2025 = buildSeason(later);
  const rows = buildAllTime([s2025, s2024]);
  const by = Object.fromEntries(rows.map((r) => [r.userId, r]));

  it('sums regular-season columns across seasons', () => {
    expect(by.uc).toMatchObject({ seasons: 2, w: 5, l: 0, t: 0, winPct: 1, pf: 510, weeklyHighs: 3 });
    expect(by.ua).toMatchObject({ w: 3, l: 2, t: 0, pf: 440, pa: 450 });
    expect(by.ua.ppg).toBe(88);
    expect(by.ua.maxPoints).toBe(484);
    expect(by.ua.efficiency).toBe(0.9091);
  });

  it('carries the streak across seasons', () => {
    expect(by.ua.streak).toBe('L1');
    expect(by.uc.streak).toBe('W5');
  });

  it('counts honors, playoff appearances and wins, toilet bowls', () => {
    expect(s2025.honors).toMatchObject({ champion: 'ua', runnerUp: 'ud', third: null, lastPlace: 'ub' });
    expect(by.ua).toMatchObject({ titles: 1, runnerUps: 0, playoffApps: 1, playoffWins: 1, toiletBowls: 0 });
    expect(by.ud).toMatchObject({ titles: 0, runnerUps: 1, playoffApps: 1, playoffWins: 0 });
    expect(by.ub).toMatchObject({ playoffApps: 0, toiletBowls: 1 });
    expect(by.uc).toMatchObject({ playoffApps: 0, toiletBowls: 0 });
  });

  it('ranks by wins then points for', () => {
    expect(rows.map((r) => r.userId)).toEqual(['uc', 'ua', 'ub', 'ud']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
  });

  it('is included in buildHistory output', () => {
    const h = buildHistory([s2024]);
    expect(h.allTime).toHaveLength(4);
    expect(h.allTime[0].userId).toBe('uc');
  });
});
