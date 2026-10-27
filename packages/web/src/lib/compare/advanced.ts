import { GROUPS } from '../grades/defs';
import type { GradedCard, GradedTile } from '../grades/grade';
import { leaders } from './leaders';

/** All, a card group, or one card's title. */
export type Bucket = string;

export interface AdvancedRow {
  card: string; key: string; label: string; style: boolean;
  /** one per player; null when he has no grades this season */
  cells: (GradedTile | null)[];
  lead: boolean[];
}

const rankedPct = (t: GradedTile | null): number | null => (t && t.status === 'ranked' && !t.style ? t.pct : null);

/**
 * The grade tiles as rows with one cell per player, filtered to a bucket. A row's leader is the best percentile among ranked,
 * non-style cells; `leads` counts each player's leading rows and `contested` the rows where anyone leads.
 */
export function advancedRows(cardsPerPlayer: (GradedCard[] | null)[], bucket: Bucket): { rows: AdvancedRow[]; leads: number[]; contested: number } {
  const base = cardsPerPlayer.find((c): c is GradedCard[] => c !== null) ?? [];
  const leads = cardsPerPlayer.map(() => 0);
  let contested = 0;
  const rows: AdvancedRow[] = [];
  for (const c of base) {
    if (bucket !== 'All' && c.group !== bucket && c.title !== bucket) continue;
    c.tiles.forEach((tile, k) => {
      const cells = cardsPerPlayer.map((cards) => cards?.find((x) => x.key === c.key)?.tiles[k] ?? null);
      const lead = tile.style ? cells.map(() => false) : leaders(cells.map(rankedPct));
      if (lead.some(Boolean)) { contested++; lead.forEach((l, i) => { if (l) leads[i]++; }); }
      rows.push({ card: c.title, key: tile.key, label: tile.label, style: tile.style, cells, lead });
    });
  }
  return { rows, leads, contested };
}

/** The bucket pills: All, the card groups present, then each card's title. */
export function bucketsFor(cards: GradedCard[]): Bucket[] {
  return ['All', ...GROUPS.filter((g) => cards.some((c) => c.group === g)), ...cards.map((c) => c.title)];
}
