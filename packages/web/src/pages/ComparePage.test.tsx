import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import type { Schedule } from '@fantasy-dash/core';
import ComparePage from './ComparePage';
import { gradeFixture } from '../test/gradeFixtures';

// a data router cannot initialise under jsdom (AbortSignal), so the loader hook is stubbed and the page rendered in a memory router
let loaded: unknown;
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useLoaderData: () => loaded }));

let search = '';
function Probe() { search = useLocation().search; return null; }
const schedule: Schedule = { year: 2026, games: [5, 6, 7, 8, 9].map((week) => ({ week, home: 'TB', away: 'KC' })) };

function mount(query: string) {
  const { db, chart } = gradeFixture();
  loaded = { years: [2026], season: 2026, db, chart, schedule };
  render(<MemoryRouter initialEntries={[`/players/compare?${query}`]}><Probe /><Routes><Route path="/players/compare" element={<ComparePage />} /></Routes></MemoryRouter>);
}

describe('ComparePage', () => {
  it('empty slots show the prompt and no sections', () => {
    mount('season=2026&pos=RB');
    expect(screen.getByText('Pick up to four players to compare')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Advanced/ })).toBeNull();
    expect(screen.getAllByPlaceholderText('Search players…')).toHaveLength(4);
  });
  it('two players render two cards, the advanced table and the charts', () => {
    mount('season=2026&pos=RB&p=ra,rb');
    expect(screen.getAllByTestId('compare-card')).toHaveLength(2);
    expect(screen.getByRole('region', { name: /Advanced/ })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: /Charts/ })).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('Search players…')).toHaveLength(2);
  });
  it('picking a player updates the URL', () => {
    mount('season=2026&pos=RB&p=ra');
    const box = screen.getAllByPlaceholderText('Search players…')[0];
    fireEvent.focus(box);
    fireEvent.mouseDown(within(screen.getByRole('listbox')).getByRole('option'));
    expect(new URLSearchParams(search).get('p')).toBe('ra,rb');
  });
  it('changing position clears the players', () => {
    mount('season=2026&pos=RB&p=ra,rb');
    fireEvent.click(within(screen.getByRole('group', { name: 'Position' })).getByRole('button', { name: 'QB' }));
    const q = new URLSearchParams(search);
    expect(q.get('pos')).toBe('QB');
    expect(q.get('p')).toBeNull();
  });
  it('is titled Comparison tool, with no in-page tabs (the Players menu replaces them)', () => {
    mount('season=2026&pos=RB');
    expect(screen.getByRole('heading', { level: 1, name: 'Comparison tool' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Players' })).toBeNull();
  });
});
