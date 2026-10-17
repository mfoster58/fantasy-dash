import type { BracketGame, Game, GameSide, PlayerDirectory, PlayerLine as CoreLine, PlayoffTag, Season, StandingRow, Week } from '@fantasy-dash/core';
import type { BoardContext } from '../lib/boards/shared';

export const players: PlayerDirectory = {
  q1: { id: 'q1', name: 'Quincy One', firstName: 'Quincy', lastName: 'One', position: 'QB', team: 'KC', yearsExp: 3, birthDate: null },
  r1: { id: 'r1', name: 'Ricky One', firstName: 'Ricky', lastName: 'One', position: 'RB', team: 'SF', yearsExp: 2, birthDate: null },
  w1: { id: 'w1', name: 'Wally One', firstName: 'Wally', lastName: 'One', position: 'WR', team: 'MIA', yearsExp: 4, birthDate: null },
  t1: { id: 't1', name: 'Tony One', firstName: 'Tony', lastName: 'One', position: 'TE', team: 'KC', yearsExp: 6, birthDate: null },
  k1: { id: 'k1', name: 'Kick One', firstName: 'Kick', lastName: 'One', position: 'K', team: 'BAL', yearsExp: 8, birthDate: null },
  KC: { id: 'KC', name: 'Kansas City Chiefs', firstName: 'Kansas City', lastName: 'Chiefs', position: 'DEF', team: 'KC', yearsExp: null, birthDate: null },
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

export const standing = (userId: string, rank: number, w: number, l: number, t: number, pf: number, pa: number): StandingRow => {
  const games = w + l + t;
  return { userId, rank, w, l, t, winPct: games ? (w + t / 2) / games : 0, pf, pa, ppg: games ? pf / games : 0, maxPoints: pf + 20, efficiency: pf / (pf + 20), streak: '-', allPlay: { w: w * 2, l: l * 2, t, pct: games ? (w * 2 + t / 2) / (games * 2) : 0 }, weeklyHighs: 0 };
};
export const bracketGame = (home: string, away: string, tag: PlayoffTag, week: number): BracketGame => ({ bracket: 'winners', round: 1, matchNo: 1, placement: null, week, tag, home, away, homePoints: null, awayPoints: null, advanced: null, gameId: null });
/** the manager-side context fields, empty, for player-board tests */
export const emptyManagerCtx: Pick<BoardContext, 'teamGames' | 'managerSeasons' | 'managers'> = { teamGames: [], managerSeasons: [], managers: {} };

export const season = (year: number, weeks: Week[], champion: string | null = null, lastScoredWeek = weeks.length): Season => ({
  year, leagueId: 'L', status: 'complete', lastScoredWeek, playoffWeekStart: 3, playoffTeams: 2,
  rosterSlots: [], scoring: {}, managers: {}, brackets: { winners: [], consolation: [] }, standings: [],
  honors: { champion, runnerUp: null, third: null, pointsTitle: null, lastPlace: null }, draft: null, transactions: [], playerSeasons: {}, playerTeams: {},
  weeks,
} as Season);
