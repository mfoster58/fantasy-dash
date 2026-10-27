import type { PlayerDb } from '@fantasy-dash/core';

/** How kind a defense is to a position: rank 1 allows the most fantasy points per game. */
export interface Difficulty {
  rank: number;
  /** defenses ranked at that position */
  of: number;
  /** easy: among the `band` most generous; hard: among the `band` stingiest */
  tone: 'easy' | 'mid' | 'hard';
  perGame: number;
}

/**
 * Fantasy points each defense allows per game to each position, from the season's player weeks
 * (a row's opponent is the defense he faced), ranked so a matchup can be called easy or hard.
 * `band` is how many at each end count as easy or hard: 8 of 32 is the top and bottom quarter.
 */
export function defenseRanks(db: PlayerDb, band = 8): (team: string, pos: string) => Difficulty | null {
  // defense -> position -> week -> points
  const allowed = new Map<string, Map<string, Map<number, number>>>();
  for (const r of db.rows) {
    const pos = db.players[r.id]?.pos;
    if (!r.opp || !pos || !r.gp) continue;
    const byPos = allowed.get(r.opp) ?? new Map<string, Map<number, number>>();
    const byWeek = byPos.get(pos) ?? new Map<number, number>();
    byWeek.set(r.week, (byWeek.get(r.week) ?? 0) + (r.pts ?? 0));
    byPos.set(pos, byWeek);
    allowed.set(r.opp, byPos);
  }
  const ranked = new Map<string, Map<string, Difficulty>>();
  const positions = new Set([...allowed.values()].flatMap((m) => [...m.keys()]));
  for (const pos of positions) {
    const rows = [...allowed].flatMap(([team, byPos]) => {
      const weeks = byPos.get(pos);
      return weeks?.size ? [{ team, perGame: [...weeks.values()].reduce((a, b) => a + b, 0) / weeks.size }] : [];
    }).sort((a, b) => b.perGame - a.perGame);
    rows.forEach((r, i) => {
      const rank = i + 1;
      const tone = rank <= band ? 'easy' : rank > rows.length - band ? 'hard' : 'mid';
      const byPos = ranked.get(r.team) ?? new Map<string, Difficulty>();
      byPos.set(pos, { rank, of: rows.length, tone, perGame: Math.round(r.perGame * 10) / 10 });
      ranked.set(r.team, byPos);
    });
  }
  return (team, pos) => ranked.get(team)?.get(pos) ?? null;
}
