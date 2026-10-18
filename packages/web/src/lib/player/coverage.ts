import type { PlayerDb, PlayerId, Season } from '@fantasy-dash/core';

/** Whether the player was ever on a league roster: drafted, added, or in a lineup as a starter or on the bench. */
export function isRostered(seasons: Season[], id: PlayerId): boolean {
  return seasons.some((s) =>
    (s.draft?.picks.some((p) => p.playerId === id) ?? false)
    || s.transactions.some((t) => t.adds.some((m) => m.playerId === id))
    || s.weeks.some((w) => w.games.some((g) => g.sides.some((sd) =>
      sd.starters.some((e) => e.player?.playerId === id) || sd.bench.some((b) => b.playerId === id)))));
}

/** Seasons of player-database rows for the player, oldest first. */
export function dbYearsOf(dbs: PlayerDb[], id: PlayerId): number[] {
  return dbs.filter((d) => d.rows.some((r) => r.id === id)).map((d) => d.year).sort((a, b) => a - b);
}
