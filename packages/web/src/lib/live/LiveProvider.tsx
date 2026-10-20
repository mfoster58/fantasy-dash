import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Season, SleeperMatchup, StatMap } from '@fantasy-dash/core';
import { currentSeason, loadSeason } from '../../data/load';
import { parseScoreboard, scoreboardUrl, type NflGame } from './espn';
import { liveWeekNumber, type NflStateJson } from './overlay';
import { POLL_MS, shouldPoll } from './schedule';

const SLEEPER = 'https://api.sleeper.app/v1';

export interface LiveData {
  /** the current season as synced */
  season: Season | null;
  /** the week that is live, when Sleeper's week is one the sync has */
  week: number | null;
  matchups: SleeperMatchup[] | null;
  /** null when ESPN couldn't be read */
  games: NflGame[] | null;
  /** live stat lines, only while a box score asks for them */
  stats: StatMap | null;
  /** a refresh is scheduled */
  polling: boolean;
}

const EMPTY: LiveData = { season: null, week: null, matchups: null, games: null, stats: null, polling: false };
const LiveContext = createContext<{ data: LiveData; watchStats: () => () => void }>({ data: EMPTY, watchStats: () => () => {} });

type Fetcher = (url: string) => Promise<Response>;
const MAX_FAILURES = 3;

async function getJson<T>(fetcher: Fetcher, url: string): Promise<T> {
  const r = await fetcher(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json() as Promise<T>;
}

const visible = () => document.visibilityState === 'visible';

export function LiveProvider({ children, load = () => loadSeason(currentSeason.year), fetcher = (u) => fetch(u), now = Date.now }: {
  children: ReactNode; load?: () => Promise<Season>; fetcher?: Fetcher; now?: () => number;
}) {
  const [data, setData] = useState<LiveData>(EMPTY);
  const r = useRef({ season: null as Season | null, games: null as NflGame[] | null, failures: 0, timer: undefined as ReturnType<typeof setTimeout> | undefined, watchers: 0, hasStats: false, stopped: false, busy: false, again: false });
  const tickRef = useRef<() => Promise<void>>(async () => {});

  tickRef.current = async () => {
    const s = r.current;
    if (s.stopped || !s.season) return;
    if (s.busy) { s.again = true; return; }
    s.busy = true;
    clearTimeout(s.timer);
    const schedule = (): boolean => {
      if (s.stopped || !visible() || !shouldPoll(now(), s.games)) return false;
      s.timer = setTimeout(() => void tickRef.current(), POLL_MS);
      return true;
    };
    const season = s.season;
    try {
      const state = await getJson<NflStateJson>(fetcher, `${SLEEPER}/state/nfl`);
      const week = liveWeekNumber(season, state);
      if (week === null) {
        s.failures = 0;
        setData((d) => ({ ...d, week: null, matchups: null, stats: null, polling: false }));
        return;
      }
      const wantStats = s.watchers > 0;
      const [matchups, games, stats] = await Promise.all([
        getJson<SleeperMatchup[]>(fetcher, `${SLEEPER}/league/${season.leagueId}/matchups/${week}`),
        getJson<unknown>(fetcher, scoreboardUrl(season.year, week)).then(parseScoreboard).catch(() => null),
        wantStats ? getJson<StatMap>(fetcher, `${SLEEPER}/stats/nfl/regular/${season.year}/${week}`).catch(() => undefined) : Promise.resolve(undefined),
      ]);
      s.failures = 0;
      s.games = games;
      if (stats) s.hasStats = true;
      const polling = schedule();
      setData((d) => ({ ...d, week, matchups, games, stats: stats ?? (d.week === week ? d.stats : null), polling }));
    } catch {
      // Sleeper failed: keep what we have; three in a row and we stop until the next page load
      s.failures += 1;
      if (s.failures >= MAX_FAILURES) s.stopped = true;
      const polling = schedule();
      setData((d) => ({ ...d, polling }));
    } finally {
      s.busy = false;
      if (s.again) { s.again = false; void tickRef.current(); }
    }
  };

  useEffect(() => {
    const s = r.current;
    s.stopped = false;
    s.failures = 0;
    let alive = true;
    load().then((season) => {
      if (!alive) return;
      s.season = season;
      setData((d) => ({ ...d, season }));
      void tickRef.current();
    }).catch(() => {});
    const onVisibility = () => {
      if (visible()) void tickRef.current();
      else { clearTimeout(s.timer); setData((d) => (d.polling ? { ...d, polling: false } : d)); }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      alive = false;
      s.stopped = true;
      clearTimeout(s.timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // load, fetcher and now are fixed for the provider's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const watchStats = () => {
    const s = r.current;
    s.watchers += 1;
    if (!s.hasStats) void tickRef.current();
    return () => { s.watchers -= 1; };
  };

  return <LiveContext.Provider value={{ data, watchStats }}>{children}</LiveContext.Provider>;
}

export const useLive = (): LiveData => useContext(LiveContext).data;

/** Box scores call this so live stat lines are fetched only while one is open. */
export function useLiveStats(on: boolean): void {
  const { watchStats } = useContext(LiveContext);
  useEffect(() => (on ? watchStats() : undefined), [on]); // eslint-disable-line react-hooks/exhaustive-deps
}
