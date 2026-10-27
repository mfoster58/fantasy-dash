import { MemoryRouter } from 'react-router';
import { fireEvent, render as rtlRender, screen, within } from '@testing-library/react';
import type { Manager, StandingRow } from '@fantasy-dash/core';
import StandingsTable from './StandingsTable';

const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const row = (userId: string, rank: number, w: number, l: number, extra: Partial<StandingRow> = {}): StandingRow => ({
  userId, rank, w, l, t: 0, winPct: w / (w + l), pf: 1000 + rank, pa: 900, ppg: 100.5, maxPoints: 1200,
  efficiency: 0.8333, streak: 'W2', allPlay: { w: 20, l: 7, t: 0, pct: 0.7407 }, weeklyHighs: 1, ...extra,
});
const managers: Record<string, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: null, avatar: null, rosterId: 2 },
  c: { userId: 'c', displayName: 'cara', teamName: 'Team C', avatar: null, rosterId: 3 },
};

describe('StandingsTable', () => {
  it('renders rows in order with formatted metrics', () => {
    render(<StandingsTable rows={[row('a', 1, 6, 2), row('b', 2, 4, 4, { streak: 'L1', t: 1 }), row('c', 3, 1, 7)]} managers={managers} playoffTeams={2} year={2025} />);
    const rows = screen.getAllByTestId('standings-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Team A');
    expect(rows[0]).toHaveTextContent('alice');
    expect(rows[0]).toHaveTextContent('.750');
    expect(rows[0]).toHaveTextContent('83.3%');
    expect(rows[0]).toHaveTextContent('20-7');
    expect(rows[1]).toHaveTextContent('bob');
    expect(rows[1]).toHaveTextContent('L1');
  });

  it('links the team name to that season\'s team page and the manager to the career page', () => {
    render(<StandingsTable rows={[row('a', 1, 6, 2), row('b', 2, 4, 4)]} managers={managers} playoffTeams={2} year={2025} />);
    expect(screen.getByRole('link', { name: 'Team A' })).toHaveAttribute('href', '/teams/2025/a');
    expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute('href', '/managers/a');
    // no team name: the manager's name stands for the team and opens the team page
    expect(screen.getByRole('link', { name: 'bob' })).toHaveAttribute('href', '/teams/2025/b');
    expect(document.querySelector('a[href^="/h2h"]')).toBeNull();
  });

  it('marks the playoff cut line after the last playoff team', () => {
    render(<StandingsTable rows={[row('a', 1, 6, 2), row('b', 2, 4, 4), row('c', 3, 1, 7)]} managers={managers} playoffTeams={2} year={2025} />);
    const rows = screen.getAllByTestId('standings-row');
    expect(rows[1]).toHaveAttribute('data-playoff-cut', 'true');
    expect(rows[0]).not.toHaveAttribute('data-playoff-cut');
    expect(rows[2]).not.toHaveAttribute('data-playoff-cut');
  });

  it('exposes metric definitions as header tooltips', () => {
    render(<StandingsTable rows={[]} managers={{}} playoffTeams={6} year={2025} />);
    expect(screen.getByText('All-Play')).toHaveAttribute('title', expect.stringContaining('every other team'));
    expect(screen.getByText('Eff')).toHaveAttribute('title', expect.stringContaining('max points'));
  });
  it('sorts by a column header, biggest first, again for the other way, and back to rank', () => {
    const rows = [row('a', 1, 6, 2, { pf: 900 }), row('b', 2, 4, 4, { pf: 1100 }), row('c', 3, 1, 7, { pf: 1000 })];
    render(<StandingsTable rows={rows} managers={managers} playoffTeams={2} year={2025} />);
    const order = () => screen.getAllByTestId('standings-row').map((r) => within(r).getAllByRole('link')[0].textContent);
    expect(order()).toEqual(['Team A', 'bob', 'Team C']);
    expect(screen.getByRole('columnheader', { name: '#' })).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(screen.getByRole('button', { name: 'PF' }));
    expect(order()).toEqual(['bob', 'Team C', 'Team A']);
    expect(screen.getByRole('columnheader', { name: 'PF' })).toHaveAttribute('aria-sort', 'descending');
    // the playoff cut only means something in rank order
    expect(document.querySelector('[data-playoff-cut]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'PF' }));
    expect(order()).toEqual(['Team A', 'Team C', 'bob']);
    fireEvent.click(screen.getByRole('button', { name: '#' }));
    expect(order()).toEqual(['Team A', 'bob', 'Team C']);
    expect(document.querySelector('[data-playoff-cut]')).not.toBeNull();
  });
  it('sorts streaks by length, wins above losses', () => {
    const rows = [row('a', 1, 6, 2, { streak: 'L1' }), row('b', 2, 4, 4, { streak: 'W3' }), row('c', 3, 1, 7, { streak: 'L4' })];
    render(<StandingsTable rows={rows} managers={managers} playoffTeams={2} year={2025} />);
    fireEvent.click(screen.getByRole('button', { name: 'Strk' }));
    expect(screen.getAllByTestId('standings-row').map((r) => within(r).getAllByRole('link')[0].textContent)).toEqual(['bob', 'Team A', 'Team C']);
  });
});
