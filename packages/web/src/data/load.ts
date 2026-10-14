import type { History, HistorySeason, PlayerDirectory, Season } from '@fantasy-dash/core';

// import.meta.glob keeps tsc from type-inferring multi-megabyte JSON literals.
const historyMod = import.meta.glob<{ default: History }>('../../../../data/history.json', { eager: true });
const playersMod = import.meta.glob<{ default: PlayerDirectory }>('../../../../data/players.json', { eager: true });
const seasonMods = import.meta.glob<{ default: Season }>('../../../../data/seasons/*.json');

export const history: History = Object.values(historyMod)[0].default;
export const players: PlayerDirectory = Object.values(playersMod)[0].default;
export const currentSeason: HistorySeason = history.seasons[history.seasons.length - 1];

const cache = new Map<number, Promise<Season>>();

export function loadSeason(year: number): Promise<Season> {
  let pending = cache.get(year);
  if (!pending) {
    const key = Object.keys(seasonMods).find((k) => k.endsWith(`/${year}.json`));
    if (!key) return Promise.reject(new Response(`No data for season ${year}`, { status: 404 }));
    pending = seasonMods[key]().then((m) => m.default);
    cache.set(year, pending);
  }
  return pending;
}
