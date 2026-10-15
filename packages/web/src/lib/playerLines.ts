import type { PlayerDirectory, PlayerId, PlayerLine as CoreLine, PlayoffTag, Season, UserId } from '@fantasy-dash/core';

export type PosFilter = 'All' | 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'K' | 'DEF';
export const POS_FILTERS: readonly PosFilter[] = ['All', 'QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF'];
export function isPosFilter(v: string | null | undefined): v is PosFilter {
  return (POS_FILTERS as readonly string[]).includes(v ?? '');
}

/** One player on one roster in one played week. */
export interface PlayerLine {
  playerId: PlayerId;
  userId: UserId;
  year: number;
  week: number;
  gameId: string;
  matchupId: number;
  tag: PlayoffTag | null;
  started: boolean;
  points: number;
  yards: number;
  touchdowns: number;
  receptions: number;
  /** true when the line carries any recorded stat; the per-week games-played flag is not persisted */
  played: boolean;
  /** championship bracket only */
  postseason: boolean;
  /** from the player directory; '?' when unknown */
  position: string;
}

export const POSTSEASON_TAGS: ReadonlySet<string> = new Set(['QF', 'SF', 'Final', '3rd', '5th']);

const n = (stats: Record<string, number>, key: string) => stats[key] ?? 0;

export function flattenLines(seasons: Season[], players: PlayerDirectory): PlayerLine[] {
  const out: PlayerLine[] = [];
  for (const s of seasons) {
    for (const wk of s.weeks) {
      if (!wk.played) continue;
      for (const g of wk.games) {
        const postseason = g.tag !== null && POSTSEASON_TAGS.has(g.tag);
        for (const sideOf of g.sides) {
          const push = (p: CoreLine, started: boolean) => {
            const st = p.stats ?? {};
            out.push({
              playerId: p.playerId, userId: sideOf.userId, year: s.year, week: wk.week, gameId: g.id, matchupId: g.matchupId,
              tag: g.tag, started, points: p.points,
              yards: n(st, 'pass_yd') + n(st, 'rush_yd') + n(st, 'rec_yd'),
              touchdowns: n(st, 'pass_td') + n(st, 'rush_td') + n(st, 'rec_td'),
              receptions: n(st, 'rec'),
              played: Object.keys(st).length > 0,
              postseason,
              position: players[p.playerId]?.position ?? '?',
            });
          };
          for (const e of sideOf.starters) if (e.player) push(e.player, true);
          for (const b of sideOf.bench) push(b, false);
        }
      }
    }
  }
  return out;
}

const FLEX = new Set(['RB', 'WR', 'TE']);

export function filterLines(lines: PlayerLine[], pos: PosFilter): PlayerLine[] {
  if (pos === 'All') return lines;
  if (pos === 'FLEX') return lines.filter((l) => FLEX.has(l.position));
  return lines.filter((l) => l.position === pos);
}
