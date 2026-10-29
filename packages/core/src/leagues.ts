import type { SleeperLeague } from './sleeper/types';

/** One league the site serves; see league.config.ts. */
export interface LeagueConfig {
  /** URL segment: lowercase letters, digits and hyphens; unique */
  slug: string;
  /** the current season's Sleeper league id; earlier seasons come from the previous_league_id chain */
  leagueId: string;
  name: string;
  /** Optional display-name overrides keyed by Sleeper user_id. */
  managerNames: Record<string, string>;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Problems with the league list; empty when it is valid. `reserved` are the app's top-level route names. */
export function validateLeagues(leagues: readonly LeagueConfig[], defaultLeague: string, reserved: Iterable<string>): string[] {
  const errs: string[] = [];
  if (leagues.length === 0) errs.push('no leagues configured');
  const routes = new Set(reserved);
  const seen = new Set<string>();
  for (const l of leagues) {
    if (!SLUG.test(l.slug)) errs.push(`slug "${l.slug}" must be lowercase letters, digits and hyphens`);
    if (seen.has(l.slug)) errs.push(`duplicate slug "${l.slug}"`);
    if (routes.has(l.slug)) errs.push(`slug "${l.slug}" is a route name`);
    seen.add(l.slug);
  }
  if (!seen.has(defaultLeague)) errs.push(`defaultLeague "${defaultLeague}" is not a configured slug`);
  return errs;
}

/** One NFL season the shared data covers. */
export interface NflYear { year: number; season: string; complete: boolean; throughWeek: number }

/** Every season any league played, newest first: complete when any league that year is, else scored through the furthest league's week. */
export function nflYears(chains: SleeperLeague[][]): NflYear[] {
  const by = new Map<number, NflYear>();
  for (const l of chains.flat()) {
    const year = Number(l.season);
    const complete = l.status === 'complete';
    const through = complete ? 18 : Math.min(18, l.settings.last_scored_leg ?? 0);
    const prev = by.get(year);
    by.set(year, prev
      ? { ...prev, complete: prev.complete || complete, throughWeek: prev.complete || complete ? 18 : Math.max(prev.throughWeek, through) }
      : { year, season: l.season, complete, throughWeek: through });
  }
  return [...by.values()].sort((a, b) => b.year - a.year);
}

/** Run fn for each league in turn; a league that throws is logged and skipped. */
export async function runPerLeague<T>(leagues: readonly LeagueConfig[], fn: (l: LeagueConfig) => Promise<T>, log: (m: string) => void): Promise<{ results: Map<string, T>; failed: string[] }> {
  const results = new Map<string, T>();
  const failed: string[] = [];
  for (const l of leagues) {
    try { results.set(l.slug, await fn(l)); } catch (err) { failed.push(l.slug); log(`✗ ${l.slug}: ${err instanceof Error ? err.message : String(err)}`); }
  }
  return { results, failed };
}
