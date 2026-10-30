import { useEffect, useRef, useState } from 'react';
import type { NflState } from '../live/espn';
import { parseSummary, summaryUrl, type EspnGameFeed } from './espnGame';

/** ESPN refreshes a game's play-by-play about every 9 seconds */
export const FEED_POLL_MS = 10_000;

export interface FeedGame { id: string; state: NflState }
type Fetcher = (url: string) => Promise<Response>;

/** finished games never change: read once per visit */
const finished = new Map<string, EspnGameFeed>();
export const clearFinishedFeeds = () => finished.clear();

const visible = () => document.visibilityState === 'visible';

/**
 * The play-by-play of each NFL game that is on or over, kept current: games in progress are read again every 10
 * seconds while the tab is visible, and the moment it comes back. A failed read keeps the last good one.
 */
export function useGameFeeds(games: FeedGame[], { fetcher = (u) => fetch(u), poll = FEED_POLL_MS }: { fetcher?: Fetcher; poll?: number } = {}): Record<string, EspnGameFeed> {
  const [feeds, setFeeds] = useState<Record<string, EspnGameFeed>>(() => Object.fromEntries(games.flatMap((g) => (finished.has(g.id) ? [[g.id, finished.get(g.id)!]] : []))));
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const key = games.map((g) => `${g.id}:${g.state}`).sort().join(',');

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const list = key ? key.split(',').map((k) => { const [id, state] = k.split(':'); return { id, state: state as NflState }; }) : [];
    const on = list.filter((g) => g.state === 'in');

    const read = async (g: FeedGame) => {
      try {
        const r = await fetchRef.current(summaryUrl(g.id));
        if (!r.ok) return;
        const feed = parseSummary(await r.json());
        if (!feed || !alive) return;
        if (g.state === 'post') finished.set(g.id, feed);
        setFeeds((f) => ({ ...f, [g.id]: feed }));
      } catch { /* keep the last good read */ }
    };
    const tick = () => {
      clearTimeout(timer);
      if (!alive || !visible() || !on.length) return;
      void Promise.all(on.map(read));
      timer = setTimeout(tick, poll);
    };
    const onVisibility = () => { if (visible()) tick(); else clearTimeout(timer); };

    for (const g of list) {
      if (g.state === 'post') {
        const done = finished.get(g.id);
        if (done) setFeeds((f) => (f[g.id] === done ? f : { ...f, [g.id]: done }));
        else void read(g);
      }
    }
    tick();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { alive = false; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [key, poll]);

  return feeds;
}
