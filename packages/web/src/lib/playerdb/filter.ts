import type { DbPlayer, PlayerDb, PlayerId, UserId } from '@fantasy-dash/core';
import type { Agg } from './aggregate';
import { tabPositions } from './columns';
import type { DbState } from './url';

/**
 * A first-year player in `season`. The database keeps today's years in the league for every season,
 * so a drafted player is a rookie in his draft year, and an undrafted one when his years match the seasons since.
 */
export function isRookie(p: DbPlayer, season: number, now: number): boolean {
  if (p.draft) return p.draft.year === season;
  return p.yearsExp === now - season;
}

/** The position tab alone: the pool every row is tinted against. */
export function tabPool(aggs: Agg[], db: PlayerDb, state: DbState): Agg[] {
  const positions = tabPositions(state.tab);
  return aggs.filter((a) => { const p = db.players[a.id]; return !!p && positions.includes(p.pos); });
}

/** The rows on show: the tab, the roster filter, the NFL team, rookies and the search. `now` is the latest season, for rookies. */
export function filterAggs(aggs: Agg[], db: PlayerDb, state: DbState, rosters: Record<PlayerId, UserId>, now: number): Agg[] {
  const q = state.q.trim().toLowerCase();
  return tabPool(aggs, db, state).filter((a) => {
    const p = db.players[a.id];
    const owner = rosters[a.id];
    if (state.roster === 'rostered' && !owner) return false;
    if (state.roster === 'fa' && owner) return false;
    if (state.roster !== 'all' && state.roster !== 'rostered' && state.roster !== 'fa' && owner !== state.roster) return false;
    if (state.team !== 'all' && a.team !== state.team) return false;
    if (state.rookies && !isRookie(p, db.year, now)) return false;
    return !q || p.name.toLowerCase().includes(q);
  });
}
