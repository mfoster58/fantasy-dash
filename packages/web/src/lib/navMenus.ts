import type { History, Season, UserId } from '@fantasy-dash/core';
import { plural } from './boards/shared';

/** One row of a top-bar dropdown: who, where it goes, and a line under the name. */
/** `plain`: a page link, drawn without an avatar */
export interface MenuEntry { userId: UserId; title: string; subtitle: string | null; avatar: string | null; to: string; plain?: boolean }

/** The Players tab: the player database and the comparison tool. */
export const playerEntries: MenuEntry[] = [
  { userId: 'players-db', title: 'Database', subtitle: 'Every player, sortable and filterable', avatar: null, to: '/players', plain: true },
  { userId: 'players-compare', title: 'Comparison tool', subtitle: 'Up to four players side by side', avatar: null, to: '/players/compare', plain: true },
];

/** This season's teams in standings order; the team name leads, the manager sits under it. */
export function rosterEntries(season: Season): MenuEntry[] {
  return season.standings.map((r) => {
    const m = season.managers[r.userId];
    const manager = m?.displayName ?? r.userId;
    return { userId: r.userId, title: m?.teamName ?? manager, subtitle: m?.teamName ? manager : null, avatar: m?.avatar ?? null, to: `/teams/${season.year}/${r.userId}` };
  });
}

/** Everyone who has managed a team, in all-time rank order. */
export function managerEntries(history: History): MenuEntry[] {
  return history.allTime.map((r) => {
    const m = history.managers[r.userId];
    return { userId: r.userId, title: m?.displayName ?? r.userId, subtitle: m ? plural(m.seasons.length, 'season') : null, avatar: m?.avatar ?? null, to: `/managers/${r.userId}` };
  });
}
