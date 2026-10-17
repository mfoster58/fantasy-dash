import { numberOf } from '../fields';
import type { DbPlayer } from '../types';

export type PlayerMeta = Pick<DbPlayer, 'birthDate' | 'draft' | 'college' | 'height' | 'weight'>;

/** nflverse players.csv → per-gsis biography fields. */
export function nflPlayerMeta(rows: Iterable<Record<string, string>>): Map<string, PlayerMeta> {
  const out = new Map<string, PlayerMeta>();
  for (const r of rows) {
    if (!r.gsis_id) continue;
    const year = numberOf(r.draft_year), round = numberOf(r.draft_round), pick = numberOf(r.draft_pick);
    out.set(r.gsis_id, {
      birthDate: /^\d{4}-\d{2}-\d{2}$/.test(r.birth_date ?? '') ? r.birth_date : null,
      draft: year !== null && round !== null && pick !== null ? { year, round, pick } : null,
      college: r.college_name || null,
      height: numberOf(r.height),
      weight: numberOf(r.weight),
    });
  }
  return out;
}
