import { useEffect, useState } from 'react';
import { parseScoreboard, scoreboardUrl, type NflGame } from './espn';

/** one request per week for the life of the page; a failed one is forgotten so the next visit retries */
const cache = new Map<string, Promise<NflGame[] | null>>();

function load(year: number, week: number): Promise<NflGame[] | null> {
  const key = `${year}-${week}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = fetch(scoreboardUrl(year, week))
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => (json ? parseScoreboard(json) : null))
      .catch(() => null);
    pending.then((games) => { if (!games) cache.delete(key); });
    cache.set(key, pending);
  }
  return pending;
}

/** A week's NFL games from ESPN, for weeks the live feed doesn't cover: each player's final score in a past box score. */
export function useNflWeek(year: number, week: number, on: boolean): NflGame[] | null {
  const [games, setGames] = useState<{ key: string; games: NflGame[] | null } | null>(null);
  const key = `${year}-${week}`;
  useEffect(() => {
    if (!on) return;
    let alive = true;
    load(year, week).then((g) => { if (alive) setGames({ key, games: g }); });
    return () => { alive = false; };
  }, [year, week, on, key]);
  return on && games?.key === key ? games.games : null;
}
