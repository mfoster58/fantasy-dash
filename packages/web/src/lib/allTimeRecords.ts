import type { History, PlayoffTag, UserId } from '@fantasy-dash/core';

interface GameRef { gameId: string; year: number; week: number; tag: PlayoffTag | null }

/** One manager's score in one game. */
export interface ScoreEntry extends GameRef { userId: UserId; points: number; opponent: UserId; oppPoints: number }

/** One game, oriented from the higher score to the lower. In a tie `high` and `low` share the same points. */
export interface MatchupEntry extends GameRef {
  high: { userId: UserId; points: number };
  low: { userId: UserId; points: number };
  margin: number;
}

export interface AllTimeRecords {
  highScores: ScoreEntry[];
  lowScores: ScoreEntry[];
  closest: MatchupEntry[];
  blowouts: MatchupEntry[];
}

const newest = (x: GameRef, y: GameRef) => y.year - x.year || y.week - x.week;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** League-wide single-game records across every played game, playoffs included. Equal values rank the newer game first. */
export function allTimeRecords(h2h: History['h2h'], limit = 10): AllTimeRecords {
  const scores: ScoreEntry[] = [];
  const matchups: MatchupEntry[] = [];

  for (const series of Object.values(h2h)) {
    for (const g of series.games) {
      const ref: GameRef = { gameId: g.gameId, year: g.year, week: g.week, tag: g.tag };
      scores.push({ ...ref, userId: series.a, points: g.aPoints, opponent: series.b, oppPoints: g.bPoints });
      scores.push({ ...ref, userId: series.b, points: g.bPoints, opponent: series.a, oppPoints: g.aPoints });
      const aHigh = g.aPoints >= g.bPoints;
      matchups.push({
        ...ref,
        high: aHigh ? { userId: series.a, points: g.aPoints } : { userId: series.b, points: g.bPoints },
        low: aHigh ? { userId: series.b, points: g.bPoints } : { userId: series.a, points: g.aPoints },
        margin: round2(Math.abs(g.aPoints - g.bPoints)),
      });
    }
  }

  const rank = <T extends GameRef>(items: T[], by: (x: T, y: T) => number) => [...items].sort((x, y) => by(x, y) || newest(x, y)).slice(0, limit);

  return {
    highScores: rank(scores, (x, y) => y.points - x.points),
    lowScores: rank(scores, (x, y) => x.points - y.points),
    closest: rank(matchups, (x, y) => x.margin - y.margin),
    blowouts: rank(matchups, (x, y) => y.margin - x.margin),
  };
}
