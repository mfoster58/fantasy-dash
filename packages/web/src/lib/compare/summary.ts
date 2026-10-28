import type { PlayerDb, Schedule } from '@fantasy-dash/core';
import { defenseRanks } from '../matchups/difficulty';

export interface GameRow { week: number; opp: string; home: boolean | null; pts: number }
export interface PlayerSummary {
  games: number; total: number; avg: number | null; floor: number | null; ceil: number | null;
  /** standard deviation over the average; null under three games or with an average of zero or less */
  cv: number | null;
  /** weekly points in 5-point bins, [0,5) … [40,45), then 45+; negatives in the first */
  bins: number[];
  /** newest first */
  last5: GameRow[];
  /** his latest team this season */
  team: string;
}
export interface NextGame { week: number; opp: string | null; home: boolean; tone: 'easy' | 'mid' | 'hard' | null; rank: number | null; of: number | null }

export const BIN_COUNT = 10;
const MIN_CV_GAMES = 3;
const LAST_WEEK = 18;

const homeOf = (schedule: Schedule | null, week: number, team: string): boolean | null => {
  const g = schedule?.games.find((x) => x.week === week && (x.home === team || x.away === team));
  return g ? g.home === team : null;
};

/** His season in league scoring: games played only. Floor and ceiling are his worst and best games. */
export function playerSummary(db: PlayerDb, id: string, schedule: Schedule | null): PlayerSummary {
  const rows = db.rows.filter((r) => r.id === id).sort((a, b) => a.week - b.week);
  const played = rows.filter((r) => r.gp >= 1 && r.pts !== undefined);
  const pts = played.map((r) => r.pts!);
  const games = pts.length, total = pts.reduce((a, b) => a + b, 0);
  const sorted = [...pts].sort((a, b) => a - b);
  const avg = games ? total / games : null;
  const sd = avg === null ? null : Math.sqrt(pts.reduce((a, b) => a + (b - avg) ** 2, 0) / games);
  const bins = Array<number>(BIN_COUNT).fill(0);
  for (const p of pts) bins[Math.min(BIN_COUNT - 1, Math.max(0, Math.floor(p / 5)))]++;
  return {
    games, total, avg,
    floor: games ? sorted[0] : null,
    ceil: games ? sorted[games - 1] : null,
    // a spread needs a few games, and a ratio over a zero or negative average means nothing
    cv: games >= MIN_CV_GAMES && avg !== null && avg > 0 && sd !== null ? sd / avg : null,
    bins,
    last5: played.slice(-5).reverse().map((r) => ({ week: r.week, opp: r.opp ?? '', home: homeOf(schedule, r.week, r.team), pts: r.pts! })),
    team: rows[rows.length - 1]?.team ?? '',
  };
}

/** His team's next five weeks after the latest played week (never past 18), byes included; null once no week is left. */
export function nextFive(db: PlayerDb, schedule: Schedule | null, team: string, pos: string): NextGame[] | null {
  if (!schedule) return null;
  const weeks = Array.from({ length: 5 }, (_, i) => db.throughWeek + 1 + i).filter((w) => w <= LAST_WEEK);
  if (!weeks.length) return null;
  const ranks = defenseRanks(db);
  return weeks.map((week) => {
    const g = schedule.games.find((x) => x.week === week && (x.home === team || x.away === team));
    if (!g) return { week, opp: null, home: false, tone: null, rank: null, of: null };
    const home = g.home === team, opp = home ? g.away : g.home;
    const d = ranks(opp, pos);
    return { week, opp, home, tone: d?.tone ?? null, rank: d?.rank ?? null, of: d?.of ?? null };
  });
}
