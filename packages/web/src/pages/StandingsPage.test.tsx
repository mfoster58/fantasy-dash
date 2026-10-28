import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { BracketGame, Season } from '@fantasy-dash/core';
import { season, standing, week } from '../test/playerFixtures';
import StandingsPage, { type StandingsData } from './StandingsPage';

let loaded: StandingsData;
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useLoaderData: () => loaded }));

const g = (bracket: BracketGame['bracket'], round: number, matchNo: number, tag: BracketGame['tag'], home: string | null, away: string | null): BracketGame =>
  ({ bracket, round, matchNo, placement: null, week: 14 + round, tag, home, away, homePoints: null, awayPoints: null, advanced: null, gameId: null });
const brackets = (t: (seed: number) => string | null): Season['brackets'] => ({
  winners: [g('winners', 1, 1, 'QF', t(3), t(4)), g('winners', 2, 2, 'Final', t(1), null)],
  consolation: [g('consolation', 1, 1, 'Toilet Bowl', t(5), t(6))],
});
function league(year: number, prefix: string, complete: boolean): Season {
  const s = season(year, [{ ...week(1, []), played: true }], null, 1);
  s.status = complete ? 'complete' : 'in_season';
  s.playoffTeams = 4;
  s.standings = [1, 2, 3, 4, 5, 6].map((n) => standing(`${prefix}${n}`, n, 7 - n, n, 0, 1000 - n, 900));
  s.managers = Object.fromEntries(s.standings.map((r) => [r.userId, { userId: r.userId, displayName: r.userId, teamName: `Team ${r.userId}`, avatar: null, rosterId: 1 }]));
  s.brackets = brackets(complete ? (n) => `${prefix}${n}` : () => null);
  return s;
}

describe('StandingsPage', () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* storage blocked */ } });
  it('switches between the standard table and every advanced stat for the season, and remembers the choice', () => {
    loaded = { season: league(2026, 'n', false), template: null };
    const { unmount } = render(<MemoryRouter><StandingsPage /></MemoryRouter>);
    const standard = screen.getByRole('button', { name: 'Standard' });
    const advanced = screen.getByRole('button', { name: 'Advanced' });
    expect(standard).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByTestId('standings-row')).toHaveLength(6);
    expect(screen.queryByRole('columnheader', { name: /xW/ })).toBeNull();
    fireEvent.click(advanced);
    expect(advanced).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryAllByTestId('standings-row')).toHaveLength(0);
    for (const h of [/xW/, /Luck/, /vs med/, /SOS/, /Eff/]) expect(screen.getByRole('columnheader', { name: h }), String(h)).toBeInTheDocument();
    // a single season: no seasons-played or playoff-history columns
    expect(screen.queryByRole('columnheader', { name: /Yrs/ })).toBeNull();
    unmount();
    render(<MemoryRouter><StandingsPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('under the table, projects the playoffs and the toilet bowl from today\'s table with seeds', () => {
    loaded = { season: league(2026, 'n', false), template: league(2025, 'p', true) };
    render(<MemoryRouter><StandingsPage /></MemoryRouter>);
    const playoffs = screen.getByRole('region', { name: 'Playoffs' });
    expect(playoffs).toHaveTextContent('If the season ended today');
    expect(within(playoffs).getByRole('link', { name: 'Team n3' })).toBeInTheDocument();
    expect(within(playoffs).getByTestId('seed-n3')).toHaveTextContent('3');
    const toilet = screen.getByRole('region', { name: 'Toilet bowl' });
    expect(within(toilet).getByRole('link', { name: 'Team n6' })).toBeInTheDocument();
  });
  it('shows a finished season\'s real brackets', () => {
    loaded = { season: league(2025, 'p', true), template: null };
    render(<MemoryRouter><StandingsPage /></MemoryRouter>);
    expect(screen.getByRole('region', { name: 'Playoffs' })).not.toHaveTextContent('If the season ended today');
    expect(within(screen.getByRole('region', { name: 'Playoffs' })).getByRole('link', { name: 'Team p1' })).toBeInTheDocument();
  });
});
