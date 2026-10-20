import { pickStats, round2, type GameSide, type Manager, type PlayerLine, type Season, type SleeperMatchup, type StatMap, type UserId, type Week } from '@fantasy-dash/core';

/** GET /v1/state/nfl, the fields we read */
export interface NflStateJson { season: string; season_type: string; week: number }

/** The week Sleeper says is on, when the synced season has it with games; otherwise nothing is live. */
export function liveWeekNumber(season: Season, state: NflStateJson | null): number | null {
  if (!state || Number(state.season) !== season.year || state.season_type !== 'regular') return null;
  return season.weeks[state.week - 1]?.games.length ? state.week : null;
}

/** The week the ticker shows: the live one, else the next to play, else the last played; none once the season is over. */
export function tickerWeek(season: Season, liveNo: number | null): Week | null {
  if (season.status === 'complete') return null;
  if (liveNo !== null) return season.weeks[liveNo - 1] ?? null;
  const next = season.weeks[season.lastScoredWeek];
  if (next?.games.length) return next;
  const last = season.weeks[season.lastScoredWeek - 1];
  return last?.games.length ? last : null;
}

function overlaySide(side: GameSide, m: SleeperMatchup, stats: StatMap | null): GameSide {
  const pp = m.players_points ?? {};
  // the sync knows every rostered player's projection; anyone added since has none
  const known = new Map<string, PlayerLine>();
  for (const l of [...side.starters.map((e) => e.player), ...side.bench]) if (l) known.set(l.playerId, l);
  const line = (id: string): PlayerLine => ({
    playerId: id,
    points: round2(pp[id] ?? 0),
    projected: known.get(id)?.projected ?? null,
    stats: stats ? pickStats(stats[id]) : known.get(id)?.stats ?? {},
  });
  const liveStarters = m.starters ?? [];
  // lineups change after the Tuesday sync; a team that set none keeps the synced one
  const starters = liveStarters.length
    ? side.starters.map((e, i) => {
      const id = liveStarters[i];
      return { slot: e.slot, player: id && id !== '0' ? line(id) : null };
    })
    : side.starters.map((e) => ({ slot: e.slot, player: e.player ? line(e.player.playerId) : null }));
  const starting = new Set(starters.flatMap((e) => (e.player ? [e.player.playerId] : [])));
  const bench = m.players
    ? m.players.filter((id) => !starting.has(id)).map(line).sort((x, y) => y.points - x.points)
    : side.bench.filter((l) => !starting.has(l.playerId)).map((l) => line(l.playerId));
  return { ...side, points: round2(m.custom_points ?? m.points ?? 0), starters, bench };
}

/** The synced week with Sleeper's live points, lineups and (when loaded) stat lines laid over it. */
export function liveWeek(week: Week, managers: Record<UserId, Manager>, matchups: SleeperMatchup[], stats: StatMap | null): Week {
  const byRoster = new Map(matchups.map((m) => [m.roster_id, m]));
  const sideOf = (s: GameSide): GameSide => {
    const m = byRoster.get(managers[s.userId]?.rosterId ?? -1);
    return m ? overlaySide(s, m, stats) : s;
  };
  return { ...week, games: week.games.map((g) => ({ ...g, sides: [sideOf(g.sides[0]), sideOf(g.sides[1])] })) };
}
