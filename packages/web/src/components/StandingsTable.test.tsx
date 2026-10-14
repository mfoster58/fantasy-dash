import { render, screen } from '@testing-library/react';
import type { Manager, StandingRow } from '@fantasy-dash/core';
import StandingsTable from './StandingsTable';

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
    render(<StandingsTable rows={[row('a', 1, 6, 2), row('b', 2, 4, 4, { streak: 'L1', t: 1 }), row('c', 3, 1, 7)]} managers={managers} playoffTeams={2} />);
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

  it('marks the playoff cut line after the last playoff team', () => {
    render(<StandingsTable rows={[row('a', 1, 6, 2), row('b', 2, 4, 4), row('c', 3, 1, 7)]} managers={managers} playoffTeams={2} />);
    const rows = screen.getAllByTestId('standings-row');
    expect(rows[1]).toHaveAttribute('data-playoff-cut', 'true');
    expect(rows[0]).not.toHaveAttribute('data-playoff-cut');
    expect(rows[2]).not.toHaveAttribute('data-playoff-cut');
  });

  it('exposes metric definitions as header tooltips', () => {
    render(<StandingsTable rows={[]} managers={{}} playoffTeams={6} />);
    expect(screen.getByText('All-Play')).toHaveAttribute('title', expect.stringContaining('every other team'));
    expect(screen.getByText('Eff')).toHaveAttribute('title', expect.stringContaining('max points'));
  });
});
