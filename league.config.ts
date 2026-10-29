import type { LeagueConfig } from '@fantasy-dash/core';

/** Every league the site serves, each at …/<slug>/. Leagues never link to each other. */
export const leagues: LeagueConfig[] = [
  { slug: 'husky', leagueId: '1388299227519537152', name: 'Husky Fantasy', managerNames: {} },
];

/** Position overrides keyed by Sleeper player_id, for players Sleeper files under the wrong fantasy position: an NFL fact, shared by every league. */
export const positionOverrides: Record<string, string> = {
  '12530': 'WR', // Travis Hunter (Sleeper lists him as DB)
};

/** Where old single-league URLs (before leagues had their own address) redirect to. */
export const defaultLeague = 'husky';

/** @deprecated single-league shape kept until both sync scripts loop over `leagues` (removed with that change). */
export const leagueConfig = { ...leagues[0], positionOverrides };
