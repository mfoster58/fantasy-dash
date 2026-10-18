import type { PlayerId, Season, UserId } from '@fantasy-dash/core';

/**
 * Who holds each player now. Each manager's roster comes from his own last played game (bench included),
 * so a team knocked out before the final keeps its players; then every transaction move dated after that
 * manager's last game is applied in created order.
 */
export function rosterMap(season: Season): Record<PlayerId, UserId> {
  const out: Record<PlayerId, UserId> = {};
  const lastWeek = new Map<UserId, number>();
  for (const w of [...season.weeks].reverse()) {
    if (!w.played) continue;
    for (const g of w.games) for (const side of g.sides) {
      if (lastWeek.has(side.userId)) continue;
      lastWeek.set(side.userId, w.week);
      for (const e of side.starters) if (e.player) out[e.player.playerId] = side.userId;
      for (const b of side.bench) out[b.playerId] = side.userId;
    }
  }
  const after = (userId: UserId, week: number) => week > (lastWeek.get(userId) ?? 0);
  const moves = [...season.transactions].sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : 1));
  for (const t of moves) {
    for (const d of t.drops) if (after(d.userId, t.week) && out[d.playerId] === d.userId) delete out[d.playerId];
    for (const a of t.adds) if (after(a.userId, t.week)) out[a.playerId] = a.userId;
  }
  return out;
}
