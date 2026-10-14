import { describe, it, expect } from 'vitest';
import { buildSeason } from '../src/season';
import { buildHistory } from '../src/history';
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
