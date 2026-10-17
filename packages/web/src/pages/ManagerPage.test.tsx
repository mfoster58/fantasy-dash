import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import ManagerPage from './ManagerPage';
import { history, loadAllSeasons } from '../data/load';

// a data router cannot initialise under jsdom, so the loader hook is stubbed with the real seasons
let seasons: Season[] = [];
vi.mock('react-router', async (orig) => {
  const real = await orig<typeof import('react-router')>();
  return { ...real, useLoaderData: () => seasons };
});

const mount = (userId: string) => render(
  <MemoryRouter initialEntries={[`/managers/${userId}`]}><Routes><Route path="/managers/:userId" element={<ManagerPage />} /></Routes></MemoryRouter>,
);
const champions = new Set(history.seasons.map((s) => s.honors.champion).filter(Boolean));

describe('ManagerPage', () => {
  beforeAll(async () => { seasons = await loadAllSeasons(); });

  it('hangs a championship pennant for every title the manager has won', () => {
    const champion2025 = history.seasons.find((s) => s.year === 2025)!.honors.champion!;
    mount(champion2025);
    const titles = history.seasons.filter((s) => s.honors.champion === champion2025).map((s) => `Champion ${s.year}`).reverse();
    expect(screen.getAllByRole('img', { name: /^Champion \d{4}$/ }).map((i) => i.getAttribute('aria-label'))).toEqual(titles);
  });

  it('hangs nothing for a manager without a title', () => {
    const nobody = Object.keys(history.managers).find((id) => !champions.has(id))!;
    mount(nobody);
    expect(screen.queryByRole('img', { name: /^Champion \d{4}$/ })).toBeNull();
  });
});
