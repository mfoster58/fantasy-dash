import { useEffect, useState } from 'react';
import { hasPlayerDb, loadPlayerDb } from '../../data/load';
import { defenseRanks, type Difficulty } from './difficulty';

/** The season's defense-vs-position ranks once its player database has loaded; null before then or without one. */
export function useDefenseRanks(year: number): ((team: string, pos: string) => Difficulty | null) | null {
  const [ranks, setRanks] = useState<{ year: number; of: (team: string, pos: string) => Difficulty | null } | null>(null);
  useEffect(() => {
    if (!hasPlayerDb(year)) return;
    let alive = true;
    loadPlayerDb(year).then((db) => { if (alive) setRanks({ year, of: defenseRanks(db) }); }).catch(() => {});
    return () => { alive = false; };
  }, [year]);
  return ranks?.year === year ? ranks.of : null;
}
