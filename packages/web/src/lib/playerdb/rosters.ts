import type { PlayerId, Season, UserId } from '@fantasy-dash/core';

/** Who holds each player now: the last played week's lineups (bench included), then every later transaction in created order. */
export function rosterMap(season: Season): Record<PlayerId, UserId> {
  const out: Record<PlayerId, UserId> = {};
  const last = [...season.weeks].reverse().find((w) => w.played && w.games.length > 0);
  if (last) {
    for (const g of last.games) for (const side of g.sides) {
      for (const e of side.starters) if (e.player) out[e.player.playerId] = side.userId;
      for (const b of side.bench) out[b.playerId] = side.userId;
    }
  }
  const after = last?.week ?? 0;
  const later = season.transactions.filter((t) => t.week > after).sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : 1));
  for (const t of later) {
    for (const d of t.drops) if (out[d.playerId] === d.userId) delete out[d.playerId];
    for (const a of t.adds) out[a.playerId] = a.userId;
  }
  return out;
}
