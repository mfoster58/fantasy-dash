import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import HistoryPage from './HistoryPage';
import { history, loadAllSeasons } from '../data/load';

// a data router cannot initialise under jsdom, so the loader hook is stubbed with the real seasons
let seasons: Season[] = [];
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useLoaderData: () => seasons }));

describe('HistoryPage', () => {
  beforeAll(async () => { seasons = await loadAllSeasons(); });

  it('one banner per season, newest first', () => {
    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    const years = [...history.seasons].map((s) => s.year).sort((a, b) => b - a);
    expect(screen.getAllByRole('region', { name: /\d{4} season/ }).map((r) => r.getAttribute('aria-label'))).toEqual(years.map((y) => `${y} season`));
  });

  it("links each champion's manager to the career page", () => {
    render(<MemoryRouter><HistoryPage /></MemoryRouter>);
    const champion = history.seasons.find((s) => s.status === 'complete')!.honors.champion!;
    const name = history.managers[champion].displayName;
    // a team with no stored name shows the manager's name too, linking to its team page; the manager link goes to his career
    const links = screen.getAllByRole('link', { name: new RegExp(`^${name}$`) }).map((l) => l.getAttribute('href'));
    expect(links).toContain(`/managers/${champion}`);
    expect(links.every((h) => h === `/managers/${champion}` || h?.startsWith(`/teams/`))).toBe(true);
  });
});
