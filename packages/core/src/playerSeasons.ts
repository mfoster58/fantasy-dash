import type { PlayerDirectory, PlayerId, PlayerSeasonLine, Season } from './types';
import { round2 } from './scoring';

/** Every player with at least one game, ranked within their position by points desc, id asc. */
export function playerSeasonsOf(points: Record<PlayerId, number>, games: Record<PlayerId, number>, players: PlayerDirectory): Record<PlayerId, PlayerSeasonLine> {
  const out: Record<PlayerId, PlayerSeasonLine> = {};
  const byPos = new Map<string, PlayerId[]>();
  for (const [id, g] of Object.entries(games)) {
    if (g < 1) continue;
    out[id] = { points: round2(points[id] ?? 0), games: g, posRank: null };
    const pos = players[id]?.position ?? null;
    if (pos) byPos.set(pos, [...(byPos.get(pos) ?? []), id]);
  }
  for (const ids of byPos.values()) {
    ids.sort((a, b) => out[b].points - out[a].points || (a < b ? -1 : a > b ? 1 : 0));
    ids.forEach((id, i) => { out[id].posRank = i + 1; });
  }
  return out;
}

/** Keep only the listed players; ranks are untouched. */
export function trimPlayerSeasons(season: Season, keep: Set<PlayerId>): Season {
  const playerSeasons: Record<PlayerId, PlayerSeasonLine> = {};
  for (const [id, line] of Object.entries(season.playerSeasons)) if (keep.has(id)) playerSeasons[id] = line;
  return { ...season, playerSeasons };
}
