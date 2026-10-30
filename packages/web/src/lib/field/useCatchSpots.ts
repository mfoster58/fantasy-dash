import { useEffect, useState } from 'react';
import { loadCatchSpots } from '../../data/load';

/** A week's catch spots (air yards by "CLE|1|7:13") once nflverse has the week; null before then. */
export function useCatchSpots(year: number, week: number): Record<string, number> | null {
  const [spots, setSpots] = useState<{ key: string; spots: Record<string, number> | null } | null>(null);
  const key = `${year}-${week}`;
  useEffect(() => {
    let alive = true;
    loadCatchSpots(year).then((db) => { if (alive) setSpots({ key, spots: db?.weeks[String(week)] ?? null }); }).catch(() => {});
    return () => { alive = false; };
  }, [year, week, key]);
  return spots?.key === key ? spots.spots : null;
}
