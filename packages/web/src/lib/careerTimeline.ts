import type { PlayerDirectory, PlayerId, Season, UserId } from '@fantasy-dash/core';
import type { FinishKind } from '../components/Icons';
import { playerPos } from './players';
import type { CareerSeasonLine } from './teamProfile';

export interface TimelineStop {
  year: number;
  /** the season is still being played */
  live: boolean;
  teamName: string;
  w: number; l: number; t: number;
  /** regular-season finish */
  rank: number | null;
  pf: number | null;
  /** how the season ended, when it ended on the podium or in last place */
  finish: FinishKind | null;
  pointsTitle: boolean;
  /** his top scorer that season: most points while in the starting lineup */
  top: { playerId: PlayerId; position: string; points: number } | null;
}

/** One stop per season of a manager's career, oldest first, for the career timeline. */
export function careerTimeline(lines: CareerSeasonLine[], seasons: Season[], userId: UserId, players: PlayerDirectory, displayName: string): TimelineStop[] {
  return [...lines].sort((a, b) => a.year - b.year).map((l) => {
    const started = new Map<PlayerId, number>();
    const s = seasons.find((x) => x.year === l.year);
    for (const w of s?.weeks ?? []) for (const g of w.games) for (const side of g.sides) {
      if (side.userId !== userId) continue;
      for (const st of side.starters) if (st.player) started.set(st.player.playerId, (started.get(st.player.playerId) ?? 0) + st.player.points);
    }
    const best = [...started].sort((a, b) => b[1] - a[1])[0];
    return {
      year: l.year, live: l.status !== 'complete',
      // a season without a team name falls back to the manager's name; say whose team it was
      teamName: l.teamName === displayName ? `Team ${displayName}` : l.teamName,
      w: l.row?.w ?? 0, l: l.row?.l ?? 0, t: l.row?.t ?? 0, rank: l.row?.rank ?? null, pf: l.row?.pf ?? null,
      finish: l.status === 'complete' ? l.finishIcon : null,
      pointsTitle: l.pointsTitle,
      top: best ? { playerId: best[0], position: playerPos(players, best[0]), points: Math.round(best[1] * 100) / 100 } : null,
    };
  });
}
