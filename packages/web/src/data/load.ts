import type { ChartDb, History, HistorySeason, PlayerDb, PlayerDirectory, Season } from '@fantasy-dash/core';

// import.meta.glob keeps tsc from type-inferring multi-megabyte JSON literals.
const historyMod = import.meta.glob<{ default: History }>('../../../../data/history.json', { eager: true });
const playersMod = import.meta.glob<{ default: PlayerDirectory }>('../../../../data/players.json', { eager: true });
const seasonMods = import.meta.glob<{ default: Season }>('../../../../data/seasons/*.json');
const playerDbMods = import.meta.glob<{ default: PlayerDb }>('../../../../data/playerdb/*.json');
const chartMods = import.meta.glob<{ default: ChartDb }>('../../../../data/charts/*.json');

export const history: History = Object.values(historyMod)[0].default;
export const players: PlayerDirectory = Object.values(playersMod)[0].default;
export const currentSeason: HistorySeason = history.seasons[history.seasons.length - 1];

const cache = new Map<number, Promise<Season>>();

export function loadSeason(year: number): Promise<Season> {
  let pending = cache.get(year);
  if (!pending) {
    const key = Object.keys(seasonMods).find((k) => k.endsWith(`/${year}.json`));
    if (!key) return Promise.reject(new Response(`No data for season ${year}`, { status: 404 }));
    pending = seasonMods[key]().then((m) => m.default).catch((err) => { cache.delete(year); throw err; });
    cache.set(year, pending);
  }
  return pending;
}

let allSeasons: Promise<Season[]> | null = null;
/** Every season, oldest first. Used by pages that span seasons (head-to-head). */
export function loadAllSeasons(): Promise<Season[]> {
  if (!allSeasons) {
    allSeasons = Promise.all(history.seasons.map((s) => loadSeason(s.year))).catch((err) => { allSeasons = null; throw err; });
  }
  return allSeasons;
}

const playerDbCache = new Map<number, Promise<PlayerDb>>();
const playerDbKey = (year: number) => Object.keys(playerDbMods).find((k) => k.endsWith(`/${year}.json`));

/** Whether a player database file exists for the season (a new year has none until its first sync). */
export const hasPlayerDb = (year: number): boolean => playerDbKey(year) !== undefined;

export function loadPlayerDb(year: number): Promise<PlayerDb> {
  let pending = playerDbCache.get(year);
  if (!pending) {
    const key = playerDbKey(year);
    if (!key) return Promise.reject(new Response(`No player data for ${year}`, { status: 404 }));
    pending = playerDbMods[key]().then((m) => m.default).catch((err) => { playerDbCache.delete(year); throw err; });
    playerDbCache.set(year, pending);
  }
  return pending;
}

const chartCache = new Map<number, Promise<ChartDb>>();
const chartKey = (year: number) => Object.keys(chartMods).find((k) => k.endsWith(`/${year}.json`));

/** Whether a play-by-play chart file exists for the season (none until nflverse publishes its participation file). */
export const hasCharts = (year: number): boolean => chartKey(year) !== undefined;

export function loadCharts(year: number): Promise<ChartDb> {
  let pending = chartCache.get(year);
  if (!pending) {
    const key = chartKey(year);
    if (!key) return Promise.reject(new Response(`No charts for ${year}`, { status: 404 }));
    pending = chartMods[key]().then((m) => m.default).catch((err) => { chartCache.delete(year); throw err; });
    chartCache.set(year, pending);
  }
  return pending;
}
