import { describe, it, expect } from 'vitest';
import { buildSeason } from '../src/season';
import { miniInput } from './fixtures/mini';

describe('buildSeason (mini league)', () => {
  it('carries the normalized draft', () => {
    expect(season.draft).toMatchObject({ draftId: 'DM', rounds: 2, slotOrder: ['ua', 'ub', 'uc', 'ud'] });
    expect(season.draft?.picks).toHaveLength(8);
    expect(season.draft?.picks[2]).toMatchObject({ userId: 'uc', playerId: 'q3', isKeeper: true });
    const q3 = season.draft?.picks.find((p) => p.playerId === 'q3');
    expect(q3).toMatchObject({ posDraftRank: 3, redraftPos: 1, value: 5.2, seasonPoints: 90 });
  });

  it('blanks provisional bracket seeds until the regular season is fully scored', () => {
    const input = miniInput();
    input.league.status = 'in_season';
    input.league.settings.last_scored_leg = 1;
    input.league.settings.playoff_week_start = 3;
    input.winnersBracket = [{ r: 1, m: 1, t1: 1, t2: 2, p: 1 }];
    input.losersBracket = [{ r: 1, m: 1, t1: 3, t2: 4, p: 1 }];
    const s = buildSeason(input);
    expect(s.brackets.winners).toHaveLength(1);
    expect(s.brackets.winners[0]).toMatchObject({ round: 1, tag: 'Final', home: null, away: null, advanced: null, gameId: null });
    expect(s.brackets.consolation[0]).toMatchObject({ tag: 'Toilet Bowl', home: null, away: null });

    input.league.settings.last_scored_leg = 2;
    const set = buildSeason(input);
    expect(set.brackets.winners[0]).toMatchObject({ home: 'ua', away: 'ub' });
  });
  const season = buildSeason(miniInput());
  const wk = (n: number) => season.weeks[n - 1];
  const sideOf = (week: number, userId: string) =>
    wk(week).games.flatMap((g) => g.sides).find((s) => s.userId === userId)!;

  it('sets season metadata', () => {
    expect(season).toMatchObject({
      year: 2024, leagueId: 'L2024', status: 'complete', lastScoredWeek: 3,
      playoffWeekStart: 4, playoffTeams: 2, rosterSlots: ['QB', 'RB', 'FLEX'],
    });
    expect(season.weeks).toHaveLength(3);
    expect(season.weeks.every((w) => w.played && !w.isPlayoff)).toBe(true);
    expect(season.brackets).toEqual({ winners: [], consolation: [] });
  });

  it('builds managers from users and rosters, with overrides', () => {
    expect(season.managers.ua).toEqual({ userId: 'ua', displayName: 'Alice', teamName: 'Team Alice', avatar: null, rosterId: 1 });
    expect(season.managers.ub.teamName).toBeNull();
    expect(buildSeason(miniInput(), { ub: 'Bobby' }).managers.ub.displayName).toBe('Bobby');
  });

  it('pairs matchups into games with ids, winners and margins', () => {
    const g = wk(1).games[0];
    expect(g).toMatchObject({ id: '2024-1-1', matchupId: 1, week: 1, tag: null, winner: 'ua', margin: 10 });
    expect(g.sides.map((s) => s.userId)).toEqual(['ua', 'ub']);
    const tie = wk(2).games[1];
    expect(tie).toMatchObject({ winner: null, margin: 0 });
  });

  it('builds starters in slot order with points, projections and trimmed stats', () => {
    const a = sideOf(1, 'ua');
    expect(a.starters).toEqual([
      { slot: 'QB', player: { playerId: 'q1', points: 80, projected: 10, stats: { pass_yd: 250, pass_td: 1 } } },
      { slot: 'RB', player: { playerId: 'r1', points: 10, projected: null, stats: {} } },
      { slot: 'FLEX', player: { playerId: 'w1', points: 10, projected: null, stats: {} } },
    ]);
    expect(a.bench).toEqual([{ playerId: 'b1', points: 0, projected: null, stats: {} }]);
    expect(a.projected).toBe(10);
  });

  it('computes ceiling, efficiency and swaps', () => {
    const a = sideOf(2, 'ua');
    expect(a).toMatchObject({ points: 60, ceiling: 82, efficiency: 0.7317 });
    expect(a.optimalSwaps).toEqual([{ out: 'w1', in: 'b1', gain: 22 }]);
    expect(sideOf(1, 'uc').optimalSwaps).toEqual([]);
    expect(sideOf(1, 'uc').efficiency).toBe(1);
  });

  it('annotates record entering the week and season PPG', () => {
    expect(sideOf(1, 'ua').recordBefore).toEqual({ w: 0, l: 0, t: 0 });
    expect(sideOf(3, 'ua').recordBefore).toEqual({ w: 1, l: 1, t: 0 });
    expect(sideOf(3, 'ub').recordBefore).toEqual({ w: 0, l: 1, t: 1 });
    expect(sideOf(1, 'ua').seasonPpg).toBe(93.33);
    expect(sideOf(3, 'ua').seasonPpg).toBe(93.33);
  });

  it('marks weekly high scores', () => {
    expect(season.weeks.map((w) => w.highScore)).toEqual(['ua', 'uc', 'uc']);
  });

  it('computes standings and honors', () => {
    expect(season.standings.map((r) => r.userId)).toEqual(['uc', 'ua', 'ub', 'ud']);
    expect(season.standings[1]).toMatchObject({ maxPoints: 302, efficiency: 0.9272, weeklyHighs: 1 });
    expect(season.honors).toEqual({ champion: null, runnerUp: null, third: null, lastPlace: null, pointsTitle: 'uc' });
  });

  it('treats a non-complete league as in season, limited to last_scored_leg', () => {
    const input = miniInput();
    input.league.status = 'in_season';
    input.league.settings.last_scored_leg = 2;
    const s = buildSeason(input);
    expect(s.status).toBe('in_season');
    expect(s.lastScoredWeek).toBe(2);
    expect(s.weeks[2].played).toBe(false);
    expect(s.weeks[2].games[0].winner).toBeNull();
    expect(s.weeks[2].games[0].sides[0].optimalSwaps).toEqual([]);
    expect(s.standings.find((r) => r.userId === 'uc')!.w).toBe(2);
  });

  describe('unplayed playoff weeks', () => {
    const playoffInput = (bracket: { r: number; m: number; t1?: number | null; t2?: number | null }[]) => {
      const input = miniInput();
      input.league.status = 'in_season';
      input.league.settings.last_scored_leg = 2;
      input.league.settings.playoff_week_start = 3;
      input.winnersBracket = bracket;
      // Week 3 pairs (ua, ub) and (uc, ud); only the first is a bracket game.
      const matchupIds: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 2 };
      input.matchups[3] = input.matchups[3].map((m) => ({ ...m, matchup_id: matchupIds[m.roster_id] }));
      return input;
    };

    it('keeps only games that match a known bracket pairing', () => {
      const s = buildSeason(playoffInput([{ r: 1, m: 1, t1: 1, t2: 2 }]));
      const week3 = s.weeks[2];
      expect(week3).toMatchObject({ week: 3, isPlayoff: true, played: false });
      expect(week3.games).toHaveLength(1);
      expect(week3.games[0].sides.map((x) => x.userId)).toEqual(['ua', 'ub']);
      expect(week3.games[0].tag).toBe('QF');
    });

    it('ignores a provisional bracket while the regular season is still being played', () => {
      const input = playoffInput([{ r: 1, m: 1, t1: 1, t2: 2 }]);
      input.league.settings.last_scored_leg = 1;
      const s = buildSeason(input);
      expect(s.weeks[2].games).toEqual([]);
    });

    it('drops every game before the bracket pairing is known', () => {
      const s = buildSeason(playoffInput([{ r: 1, m: 1 }]));
      expect(s.weeks[2].games).toEqual([]);
    });
  });
});
