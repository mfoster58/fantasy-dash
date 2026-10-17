import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import TeamPage from './TeamPage';
import { history, loadAllSeasons } from '../data/load';

// a data router cannot initialise under jsdom, so the loader hook is stubbed with the real seasons
let seasons: Season[] = [];
vi.mock('react-router', async (orig) => {
  const real = await orig<typeof import('react-router')>();
  return { ...real, useLoaderData: () => ({ seasons, season: seasons.find((s) => String(s.year) === real.useParams().season)! }) };
});

const mount = (year: number, userId: string) => render(
  <MemoryRouter initialEntries={[`/teams/${year}/${userId}`]}><Routes><Route path="/teams/:season/:userId" element={<TeamPage />} /></Routes></MemoryRouter>,
);
const honors2025 = history.seasons.find((s) => s.year === 2025)!.honors;

describe('TeamPage', () => {
  beforeAll(async () => { seasons = await loadAllSeasons(); });

  it('hangs the championship pennant on the champion\'s season', () => {
    mount(2025, honors2025.champion!);
    expect(screen.getByRole('img', { name: 'Champion 2025' })).toBeInTheDocument();
  });

  it('hangs nothing for the runner-up, and nothing for a season still in play', () => {
    mount(2025, honors2025.runnerUp!);
    expect(screen.queryByRole('img', { name: /^Champion/ })).toBeNull();
    const live = history.seasons.find((s) => s.status === 'in_season');
    if (live) {
      mount(live.year, honors2025.champion!);
      expect(screen.queryByRole('img', { name: /^Champion/ })).toBeNull();
    }
  });
});
