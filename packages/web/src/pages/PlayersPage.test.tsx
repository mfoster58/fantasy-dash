import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import PlayersPage from './PlayersPage';
import { miniDb } from '../test/playerDbFixtures';
import { game, line, season, side, week } from '../test/playerFixtures';

// a data router cannot initialise under jsdom (AbortSignal), so the loader hook is stubbed and the page rendered in a memory router
let loaded: unknown;
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useLoaderData: () => loaded }));

let search = '';
function Probe() { search = useLocation().search; return null; }

function mount(db: ReturnType<typeof miniDb> | null, path = '/players/2026') {
  const s = season(2026, [week(1, [game(2026, 1, 1, side('A', 100, [line('w1', 10)]), side('B', 90, [line('q1', 20)]))])], null, 1);
  s.managers = { A: { userId: 'A', displayName: 'Alice', teamName: 'Team A', avatar: null, rosterId: 1 }, B: { userId: 'B', displayName: 'Bob', teamName: null, avatar: null, rosterId: 2 } };
  s.standings = [{ userId: 'A', rank: 1, w: 1, l: 0, t: 0, winPct: 1, pf: 100, pa: 90, ppg: 100, maxPoints: 110, efficiency: 0.9, streak: 'W1', allPlay: { w: 1, l: 0, t: 0, pct: 1 }, weeklyHighs: 1 }, { userId: 'B', rank: 2, w: 0, l: 1, t: 0, winPct: 0, pf: 90, pa: 100, ppg: 90, maxPoints: 100, efficiency: 0.9, streak: 'L1', allPlay: { w: 0, l: 1, t: 0, pct: 0 }, weeklyHighs: 0 }];
  loaded = { season: s, db };
  render(<MemoryRouter initialEntries={[path]}><Probe /><Routes><Route path="/players/:season" element={<PlayersPage />} /></Routes></MemoryRouter>);
}

describe('PlayersPage', () => {
  it('renders the table for the season with the count line and the definitions', () => {
    mount(miniDb());
    expect(screen.getByRole('heading', { name: 'Players' })).toBeInTheDocument();
    expect(screen.getByText(/Showing 5 of 5 · weeks 1–3 · 2026/)).toBeInTheDocument();
    expect(screen.getAllByTestId('db-row')).toHaveLength(5);
    expect(screen.getByText('Column definitions')).toBeInTheDocument();
  });
  it('filters by tab, roster and search through the URL', () => {
    mount(miniDb(), '/players/2026?tab=wr&roster=A');
    expect(screen.getAllByTestId('db-row')).toHaveLength(1);
    expect(screen.getByTestId('db-name')).toHaveTextContent('Wide One');
    fireEvent.change(screen.getByLabelText('Roster'), { target: { value: 'fa' } });
    expect(search).toBe('?tab=wr&roster=fa');
    expect(screen.getAllByTestId('db-row').map((r) => within(r).getByTestId('db-name').textContent)).toEqual(['Wide Two']); // the WR tab holds wide receivers only, so the free-agent tight end stays out
  });
  it('sorts through the URL, first click descending, lower-is-better ascending', () => {
    mount(miniDb(), '/players/2026?tab=qb');
    fireEvent.click(within(screen.getByRole('columnheader', { name: /^INT/ })).getByRole('button'));
    expect(search).toBe('?tab=qb&sort=int&dir=asc');
    fireEvent.click(within(screen.getByRole('columnheader', { name: /^Att/ })).getByRole('button'));
    expect(search).toBe('?tab=qb&sort=att');
  });
  it('explains when the season has no player data yet', () => {
    mount(null);
    expect(screen.getByText('No player data yet for 2026')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
