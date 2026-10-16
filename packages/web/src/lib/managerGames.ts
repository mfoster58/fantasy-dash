import type { PlayoffTag, Season, StandingRow, UserId } from '@fantasy-dash/core';
import { CONSOLATION_TAGS, POSTSEASON_TAGS } from './playerLines';

/** One manager's side of one played game. */
export interface TeamGame {
  year: number; week: number; tag: PlayoffTag | null; gameId: string; matchupId: number;
  userId: UserId; opponentId: UserId;
  points: number; oppPoints: number;
  /** optimal lineup total */
  ceiling: number;
  /** ceiling − points: what the best lineup would have added */
  benchPoints: number;
  projected: number;
  result: 'W' | 'L' | 'T';
  isPlayoff: boolean;
  /** championship bracket */
  postseason: boolean;
  consolation: boolean;
  /** the manager had the week's top score (regular season only, as the data records it) */
  weekHigh: boolean;
}

/** One manager's season, from the standings row plus honors, bracket and games. */
export interface ManagerSeason {
  year: number; userId: UserId; complete: boolean;
  row: StandingRow;
  /** regular-season games played */
  games: number;
  /** sum of benchPoints over every game that season */
  benchPoints: number;
  champion: boolean; runnerUp: boolean; third: boolean; lastPlace: boolean;
  /** appears in the winners bracket */
  playoffBerth: boolean;
  /** regular-season rank */
  seed: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function teamGamesOf(seasons: Season[]): TeamGame[] {
  const out: TeamGame[] = [];
  for (const s of seasons) {
    for (const wk of s.weeks) {
      if (!wk.played) continue;
      for (const g of wk.games) {
        for (let i = 0; i < 2; i++) {
          const me = g.sides[i];
          const opp = g.sides[1 - i];
          out.push({
            year: s.year, week: wk.week, tag: g.tag, gameId: g.id, matchupId: g.matchupId,
            userId: me.userId, opponentId: opp.userId,
            points: me.points, oppPoints: opp.points, ceiling: me.ceiling, benchPoints: round2(Math.max(0, me.ceiling - me.points)), projected: me.projected,
            result: me.points > opp.points ? 'W' : me.points < opp.points ? 'L' : 'T',
            isPlayoff: wk.isPlayoff,
            postseason: g.tag !== null && POSTSEASON_TAGS.has(g.tag),
            consolation: g.tag !== null && CONSOLATION_TAGS.has(g.tag),
            weekHigh: wk.highScore === me.userId,
          });
        }
      }
    }
  }
  return out;
}

export function managerSeasonsOf(seasons: Season[], games: TeamGame[]): ManagerSeason[] {
  return seasons.flatMap((s) => s.standings.map((row): ManagerSeason => {
    const mine = games.filter((g) => g.year === s.year && g.userId === row.userId);
    return {
      year: s.year, userId: row.userId, complete: s.status === 'complete', row,
      games: row.w + row.l + row.t,
      benchPoints: round2(mine.reduce((t, g) => t + g.benchPoints, 0)),
      champion: s.honors.champion === row.userId, runnerUp: s.honors.runnerUp === row.userId, third: s.honors.third === row.userId, lastPlace: s.honors.lastPlace === row.userId,
      playoffBerth: s.brackets.winners.some((b) => b.home === row.userId || b.away === row.userId),
      seed: row.rank,
    };
  }));
}
