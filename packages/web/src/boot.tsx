import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import type { LeagueConfig } from '@fantasy-dash/core';
import { routes } from './routes';
import { initLeague } from './data/load';
import type { Where } from './lib/league';
import RootPage from './pages/RootPage';
import LeagueNotFound from './pages/LeagueNotFound';

/** Render what a URL calls for: a league's app under its own basename, the root page, not-found, or a redirect for an old link. */
export async function start(o: { where: Where; base: string; render: (el: React.ReactNode) => void; replace: (to: string) => void; init?: (l: LeagueConfig) => Promise<void> }): Promise<void> {
  const { where } = o;
  if (where.kind === 'redirect') { o.replace(where.to); return; }
  if (where.kind === 'root') { o.render(<RootPage />); return; }
  if (where.kind === 'unknown') { o.render(<LeagueNotFound />); return; }
  try { await (o.init ?? initLeague)(where.league); } catch { o.render(<LeagueNotFound />); return; }
  document.title = where.league.name;
  const router = createBrowserRouter(routes, { basename: `${o.base}/${where.league.slug}` });
  o.render(<React.StrictMode><RouterProvider router={router} /></React.StrictMode>);
}
