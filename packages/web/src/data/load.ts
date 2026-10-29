import { applyLeaguePoints, type ChartDb, type History, type HistorySeason, type LeagueConfig, type LeaguePoints, type PlayerDb, type PlayerDirectory, type Schedule, type Season, type SharedPlayerDb } from '@fantasy-dash/core';

// import.meta.glob keeps tsc from type-inferring multi-megabyte JSON literals. League files are lazy: a visitor downloads only their league.
const playersMod = import.meta.glob<{ default: PlayerDirectory }>('../../../../data/players.json', { eager: true });
const historyMods = import.meta.glob<{ default: History }>('../../../../data/leagues/*/history.json');
const seasonMods = import.meta.glob<{ default: Season }>('../../../../data/leagues/*/seasons/*.json');
const pointsMods = import.meta.glob<{ default: LeaguePoints }>('../../../../data/leagues/*/points/*.json');
const playerDbMods = import.meta.glob<{ default: SharedPlayerDb }>('../../../../data/playerdb/*.json');
const chartMods = import.meta.glob<{ default: ChartDb }>('../../../../data/charts/*.json');
const scheduleMods = import.meta.glob<{ default: Schedule }>('../../../../data/schedule/*.json');

export const players: PlayerDirectory = Object.values(playersMod)[0].default;

/** The league this page load serves, set once by initLeague before the app renders. Live bindings: read them at render or load time, never at module scope. */
export let league: LeagueConfig;
export let history: History;
export let currentSeason: HistorySeason;

const leagueKey = (mods: Record<string, unknown>, file: string) => Object.keys(mods).find((k) => k.endsWith(`/leagues/${league.slug}/${file}`));

const cache = new Map<number, Promise<Season>>();
let allSeasons: Promise<Season[]> | null = null;
const playerDbCache = new Map<number, Promise<PlayerDb>>();

/** Load a league's history and make it the current league; rejects (changing nothing) when the league has no synced data. */
export async function initLeague(l: LeagueConfig): Promise<void> {
  const key = Object.keys(historyMods).find((k) => k.endsWith(`/leagues/${l.slug}/history.json`));
  if (!key) throw new Error(`No data for league ${l.slug}`);
  const h = (await historyMods[key]()).default;
  league = l;
  history = h;
  currentSeason = h.seasons[h.seasons.length - 1];
  cache.clear();
  allSeasons = null;
  playerDbCache.clear();
}

export function loadSeason(year: number): Promise<Season> {
  let pending = cache.get(year);
  if (!pending) {
    const key = leagueKey(seasonMods, `seasons/${year}.json`);
    if (!key) return Promise.reject(new Response(`No data for season ${year}`, { status: 404 }));
    pending = seasonMods[key]().then((m) => m.default).catch((err) => { cache.delete(year); throw err; });
    cache.set(year, pending);
  }
  return pending;
}

/** Every season, oldest first. Used by pages that span seasons (head-to-head). */
export function loadAllSeasons(): Promise<Season[]> {
  if (!allSeasons) {
    allSeasons = Promise.all(history.seasons.map((s) => loadSeason(s.year))).catch((err) => { allSeasons = null; throw err; });
  }
  return allSeasons;
}

const playerDbKey = (year: number) => Object.keys(playerDbMods).find((k) => k.endsWith(`/${year}.json`));

/** Whether a player database file exists for the season (a new year has none until its first sync). */
export const hasPlayerDb = (year: number): boolean => playerDbKey(year) !== undefined;

/** The shared player database with this league's points, projections and xFP joined on (unscored when the league has no points file for the year). */
export function loadPlayerDb(year: number): Promise<PlayerDb> {
  let pending = playerDbCache.get(year);
  if (!pending) {
    const key = playerDbKey(year);
    if (!key) return Promise.reject(new Response(`No player data for ${year}`, { status: 404 }));
    const pk = leagueKey(pointsMods, `points/${year}.json`);
    pending = Promise.all([playerDbMods[key](), pk ? pointsMods[pk]() : Promise.resolve(null)])
      .then(([db, pts]) => applyLeaguePoints(db.default, pts?.default ?? null))
      .catch((err) => { playerDbCache.delete(year); throw err; });
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

const scheduleCache = new Map<number, Promise<Schedule>>();
const scheduleKey = (year: number) => Object.keys(scheduleMods).find((k) => k.endsWith(`/${year}.json`));

/** Whether the season's NFL schedule file exists. */
export const hasSchedule = (year: number): boolean => scheduleKey(year) !== undefined;

export function loadSchedule(year: number): Promise<Schedule> {
  let pending = scheduleCache.get(year);
  if (!pending) {
    const key = scheduleKey(year);
    if (!key) return Promise.reject(new Response(`No schedule for ${year}`, { status: 404 }));
    pending = scheduleMods[key]().then((m) => m.default).catch((err) => { scheduleCache.delete(year); throw err; });
    scheduleCache.set(year, pending);
  }
  return pending;
}
