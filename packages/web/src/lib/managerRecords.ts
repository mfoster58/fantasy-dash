import type { History, PlayerDirectory, Season, UserId } from '@fantasy-dash/core';
import { boardsFor, championsOf, draftValuesOf, lastPlacesOf, type BoardContext } from './playerBoards';
import { subTabsOf } from './boards/tabs';
import { managerSeasonsOf, teamGamesOf } from './managerGames';
import { flattenLines } from './playerLines';
import { playerName } from './players';
import { fitXfp } from './xfp';

export interface ManagerRecord {
  sub: string; subTitle: string; boardId: string; title: string;
  rank: number; valueLabel: string; meta: string; detail: string | null;
}

/** The Records page's all-time, all-positions context. */
export function allTimeContext(seasons: Season[], players: PlayerDirectory, managers: History['managers']): BoardContext {
  const lines = flattenLines(seasons, players);
  const teamGames = teamGamesOf(seasons);
  return {
    lines, players, champions: championsOf(seasons), lastPlaces: lastPlacesOf(seasons), year: null,
    currentYear: Math.max(...seasons.map((s) => s.year)), pos: 'All', picks: draftValuesOf(seasons), xfp: fitXfp(lines),
    transactions: seasons.map((s) => ({ year: s.year, transactions: s.transactions })),
    playerSeasons: Object.fromEntries(seasons.map((s) => [s.year, s.playerSeasons])),
    drafts: Object.fromEntries(seasons.map((s) => [s.year, s.draft])),
    teamGames, managerSeasons: managerSeasonsOf(seasons, teamGames), managers,
  };
}

/** Every manager board (default direction and mode) on which the manager's own row sits at rank ≤ maxRank, in Records-page order. */
export function managerRecords(ctx: BoardContext, userId: UserId, maxRank = 3): ManagerRecord[] {
  const out: ManagerRecord[] = [];
  for (const sub of subTabsOf('managers')) {
    for (const def of boardsFor('managers', sub.id)) {
      const rows = def.compute(ctx);
      const idx = rows.findIndex((r) => r.playerId === null && r.userId === userId);
      if (idx < 0) continue;
      const r = rows[idx];
      // tied rows share a rank, as the Records page crowns them
      const rank = rows.findIndex((o) => o.value === r.value) + 1;
      if (rank > maxRank) continue;
      // the Records page shows a row's player beside the manager; here the name leads the detail instead
      const detail = r.player ? [playerName(ctx.players, r.player), r.detail].filter(Boolean).join(' · ') : r.detail;
      // transaction tallies carry only a season count as their meta, which says nothing on a profile
      out.push({ sub: sub.id, subTitle: sub.title, boardId: def.id, title: def.title, rank, valueLabel: r.valueLabel, meta: sub.id === 'mtransactions' ? '' : r.meta, detail });
    }
  }
  return out;
}
