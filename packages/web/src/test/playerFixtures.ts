import type { Game, GameSide, PlayerDirectory, PlayerLine as CoreLine, Season, Week } from '@fantasy-dash/core';

export const players: PlayerDirectory = {
  q1: { id: 'q1', name: 'Quincy One', firstName: 'Quincy', lastName: 'One', position: 'QB', team: 'KC', yearsExp: 3 },
  r1: { id: 'r1', name: 'Ricky One', firstName: 'Ricky', lastName: 'One', position: 'RB', team: 'SF', yearsExp: 2 },
  w1: { id: 'w1', name: 'Wally One', firstName: 'Wally', lastName: 'One', position: 'WR', team: 'MIA', yearsExp: 4 },
  t1: { id: 't1', name: 'Tony One', firstName: 'Tony', lastName: 'One', position: 'TE', team: 'KC', yearsExp: 6 },
  k1: { id: 'k1', name: 'Kick One', firstName: 'Kick', lastName: 'One', position: 'K', team: 'BAL', yearsExp: 8 },
  KC: { id: 'KC', name: 'Kansas City Chiefs', firstName: 'Kansas City', lastName: 'Chiefs', position: 'DEF', team: 'KC', yearsExp: null },
};

export const line = (playerId: string, points: number, stats: Record<string, number> = { rec: 1 }): CoreLine => ({ playerId, points, projected: null, stats });

export const side = (userId: string, points: number, starters: CoreLine[], bench: CoreLine[] = []): GameSide => ({
  userId, points, projected: 100, ceiling: points + 10, efficiency: 0.9,
  starters: starters.map((p) => ({ slot: 'FLEX', player: p })),
  bench, optimalSwaps: [], recordBefore: { w: 0, l: 0, t: 0 }, seasonPpg: 100,
});

export const game = (year: number, week: number, matchupId: number, a: GameSide, b: GameSide, tag: Game['tag'] = null): Game => ({
  id: `${year}-${week}-${matchupId}`, matchupId, week, tag, sides: [a, b],
  winner: a.points > b.points ? a.userId : b.points > a.points ? b.userId : null, margin: Math.abs(a.points - b.points),
});

export const week = (n: number, games: Game[], isPlayoff = false): Week => ({ week: n, isPlayoff, played: games.length > 0, games, highScore: null });

export const season = (year: number, weeks: Week[], champion: string | null = null, lastScoredWeek = weeks.length): Season => ({
  year, leagueId: 'L', status: 'complete', lastScoredWeek, playoffWeekStart: 3, playoffTeams: 2,
  rosterSlots: [], scoring: {}, managers: {}, brackets: { winners: [], consolation: [] }, standings: [],
  honors: { champion, runnerUp: null, third: null, pointsTitle: null, lastPlace: null }, draft: null,
  weeks,
} as Season);
