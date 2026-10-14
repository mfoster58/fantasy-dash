import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Game, GameSide, Manager, PlayerDirectory } from '@fantasy-dash/core';
import ScoreCard from './ScoreCard';

const side = (userId: string, points: number, starters: [string, number][]): GameSide => ({
  userId, points, projected: 100, ceiling: points + 10, efficiency: 0.9,
  starters: starters.map(([id, pts], i) => ({ slot: i === 0 ? 'QB' : 'RB', player: { playerId: id, points: pts, projected: null, stats: {} } })),
  bench: [], optimalSwaps: [], recordBefore: { w: 3, l: 1, t: 0 }, seasonPpg: 105.5,
});
const managers: Record<string, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: 'Team B', avatar: null, rosterId: 2 },
};
const players: PlayerDirectory = {
  q1: { id: 'q1', name: 'Quincy One', firstName: 'Quincy', lastName: 'One', position: 'QB', team: 'KC', yearsExp: 3 },
  r1: { id: 'r1', name: 'Ricky One', firstName: 'Ricky', lastName: 'One', position: 'RB', team: 'SF', yearsExp: 2 },
  q2: { id: 'q2', name: 'Quinn Two', firstName: 'Quinn', lastName: 'Two', position: 'QB', team: 'BUF', yearsExp: 5 },
  r2: { id: 'r2', name: 'Rob Two', firstName: 'Rob', lastName: 'Two', position: 'RB', team: 'DET', yearsExp: 1 },
};
const base = (a: GameSide, b: GameSide, winner: string | null, tag: Game['tag'] = null): Game => ({
  id: '2025-3-1', matchupId: 1, week: 3, tag, sides: [a, b], winner, margin: Math.abs(a.points - b.points),
});
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ScoreCard', () => {
  it('shows scores, records, efficiency and the top three starters per team', () => {
    const g = base(side('a', 120.5, [['q1', 30], ['r1', 12]]), side('b', 99.25, [['q2', 25], ['r2', 8]]), 'a');
    wrap(<ScoreCard game={g} played managers={managers} players={players} to="/x" />);
    expect(screen.getByText('120.50')).toBeInTheDocument();
    expect(screen.getByText('99.25')).toBeInTheDocument();
    expect(screen.getAllByText('3-1')).toHaveLength(2);
    expect(screen.getAllByText('90%')).toHaveLength(2);
    expect(screen.getByText('Quincy One')).toBeInTheDocument();
    expect(screen.getByText('Quinn Two')).toBeInTheDocument();
    expect(screen.getByText('Ricky One')).toBeInTheDocument();
    expect(screen.getByText('Rob Two')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.getByText('Won by 21.25')).toBeInTheDocument();
    expect(screen.getByText('Week 3')).toBeInTheDocument();
  });

  it('labels a tie', () => {
    const g = base(side('a', 100, [['q1', 30]]), side('b', 100, [['q2', 30]]), null);
    wrap(<ScoreCard game={g} played managers={managers} players={players} to="/x" />);
    expect(screen.getAllByText('Tie').length).toBeGreaterThan(0);
  });

  it('shows projections for an upcoming game and no performers', () => {
    const g = base(side('a', 0, []), side('b', 0, []), null);
    wrap(<ScoreCard game={g} played={false} managers={managers} players={players} to="/x" />);
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getByText('Projected')).toBeInTheDocument();
    expect(screen.getAllByText(/100\.00 proj/)).toHaveLength(2);
    expect(screen.queryByText('Tie')).not.toBeInTheDocument();
  });

  it('shows the playoff tag and links to the box score', () => {
    const g = base(side('a', 100, [['q1', 30]]), side('b', 90, [['q2', 30]]), 'a', 'Final');
    wrap(<ScoreCard game={g} played managers={managers} players={players} to="/scores/2025/17/1" />);
    expect(screen.getByText('Championship')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/scores/2025/17/1');
  });
});
