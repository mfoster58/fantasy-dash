import type { RouteObject } from 'react-router';
import type { LeagueConfig } from '@fantasy-dash/core';

export type Where = { kind: 'league'; league: LeagueConfig } | { kind: 'root' } | { kind: 'redirect'; to: string } | { kind: 'unknown' };

/** Which league a URL is for. `base` is BASE_URL without its trailing slash; `rest` is search + hash. */
export function resolveLeague(o: { pathname: string; rest: string; base: string; leagues: readonly LeagueConfig[]; legacy: ReadonlySet<string>; defaultSlug: string }): Where {
  const path = o.base && o.pathname.startsWith(o.base) ? o.pathname.slice(o.base.length) : o.pathname;
  const segs = path.split('/').filter(Boolean);
  if (segs.length === 0) return { kind: 'root' };
  const league = o.leagues.find((l) => l.slug === segs[0]);
  if (league) return { kind: 'league', league };
  if (o.legacy.has(segs[0])) return { kind: 'redirect', to: `${o.base}/${o.defaultSlug}/${segs.join('/')}${o.rest}` };
  return { kind: 'unknown' };
}

/** The first path segment of every top-level route: links from before leagues had their own address. */
export function legacyHeads(routes: RouteObject[]): Set<string> {
  const out = new Set<string>();
  for (const r of routes) for (const c of r.children ?? []) { const head = c.path?.split('/')[0]; if (head) out.add(head); }
  return out;
}
