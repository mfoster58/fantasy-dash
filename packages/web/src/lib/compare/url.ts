import type { PlayerDb } from '@fantasy-dash/core';

/** Players compared together: WR and TE share one group. */
export type PosGroup = 'QB' | 'RB' | 'WRTE';
export const POS_GROUPS: readonly PosGroup[] = ['QB', 'RB', 'WRTE'];
export const GROUP_LABEL: Record<PosGroup, string> = { QB: 'QB', RB: 'RB', WRTE: 'WR / TE' };
export const MAX_SLOTS = 4;

export const groupOf = (pos: string): PosGroup | null => (pos === 'QB' || pos === 'RB' ? pos : pos === 'WR' || pos === 'TE' ? 'WRTE' : null);

export interface CompareState { season: number; pos: PosGroup; ids: string[] }

/**
 * The comparison from the URL. An unknown season falls back to the newest, an unknown position to RB; ids not in the season's
 * database, of another group, or repeated are dropped, and at most four are kept.
 */
export function parseCompare(search: URLSearchParams, seasons: number[], db: PlayerDb | null): CompareState {
  const asked = Number(search.get('season'));
  const season = seasons.includes(asked) ? asked : Math.max(...seasons);
  const p = search.get('pos') as PosGroup;
  const pos = POS_GROUPS.includes(p) ? p : 'RB';
  const ids: string[] = [];
  for (const id of (search.get('p') ?? '').split(',')) {
    const pl = db?.players[id];
    if (!pl || groupOf(pl.pos) !== pos || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length === MAX_SLOTS) break;
  }
  return { season, pos, ids };
}

export function compareHref(s: CompareState): string {
  return `/players/compare?season=${s.season}&pos=${s.pos}${s.ids.length ? `&p=${s.ids.join(',')}` : ''}`;
}
