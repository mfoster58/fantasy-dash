import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { initLeague } from './data/load';
import { initTheme } from './lib/theme';
import { leagues, defaultLeague } from '../../../league.config';
import './index.css';

initTheme();

// Interim (Task 5 replaces this): serve the default league, loaded before the router module is evaluated.
async function start() {
  await initLeague(leagues.find((l) => l.slug === defaultLeague)!);
  const { router } = await import('./App');
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  );
}
void start();
