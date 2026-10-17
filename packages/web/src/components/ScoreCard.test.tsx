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
  q1: { id: 'q1', name: 'Quincy One', firstName: 'Quincy', lastName: 'One', position: 'QB', team: 'KC', yearsExp: 3, birthDate: null },
  r1: { id: 'r1', name: 'Ricky One', firstName: 'Ricky', lastName: 'One', position: 'RB', team: 'SF', yearsExp: 2, birthDate: null },
  q2: { id: 'q2', name: 'Quinn Two', firstName: 'Quinn', lastName: 'Two', position: 'QB', team: 'BUF', yearsExp: 5, birthDate: null },
  r2: { id: 'r2', name: 'Rob Two', firstName: 'Rob', lastName: 'Two', position: 'RB', team: 'DET', yearsExp: 1, birthDate: null },
};
const base = (a: GameSide, b: GameSide, winner: string | null, tag: Game['tag'] = null): Game => ({
  id: '2025-3-1', matchupId: 1, week: 3, tag, sides: [a, b], winner, margin: Math.abs(a.points - b.points),
});
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ScoreCard', () => {
  it('shows scores, records, efficiency and the top three starters per team', () => {
    const g = base(side('a', 120.5, [['q1', 30], ['r1', 12]]), side('b', 99.25, [['q2', 25], ['r2', 8]]), 'a');
    wrap(<ScoreCard seasonTeams={{}} game={g} played managers={managers} players={players} to="/x" year={2025} />);
    expect(screen.getByText('120.50')).toBeInTheDocument();
    expect(screen.getByText('99.25')).toBeInTheDocument();
    expect(screen.getAllByText('3-1')).toHaveLength(2);
    expect(screen.getAllByText('90%')).toHaveLength(2);
    expect(screen.getByText('Quincy One')).toBeInTheDocument();
    expect(screen.getByText('Quinn Two')).toBeInTheDocument();
    expect(screen.getByText('Ricky One')).toBeInTheDocument();
    expect(screen.getByText('Rob Two')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.queryByText(/Won by/)).not.toBeInTheDocument();
    expect(screen.queryByText('Week 3')).not.toBeInTheDocument();
  });

  it('splits performers into two columns without team headers', () => {
    const g = base(side('a', 120.5, [['q1', 30], ['r1', 12]]), side('b', 99.25, [['q2', 25], ['r2', 8]]), 'a');
    wrap(<ScoreCard seasonTeams={{}} game={g} played managers={managers} players={players} to="/x" year={2025} />);
    const heading = screen.getByText('Top performers');
    const columns = heading.nextElementSibling!.children;
    expect(columns).toHaveLength(2);
    expect(columns[0]).toHaveTextContent('Quincy One');
    expect(columns[0]).not.toHaveTextContent('Team A');
    expect(columns[1]).toHaveTextContent('Rob Two');
    expect(columns[1]).not.toHaveTextContent('Team B');
  });

  it('sets the scores side by side with vs and labeled efficiency bars', () => {
    const g = base(side('a', 120.5, [['q1', 30], ['r1', 12]]), side('b', 99.25, [['q2', 25], ['r2', 8]]), 'a');
    wrap(<ScoreCard seasonTeams={{}} game={g} played managers={managers} players={players} to="/x" year={2025} />);
    expect(screen.getByText('vs')).toBeInTheDocument();
    expect(screen.getAllByText('Efficiency')).toHaveLength(2);
    expect(screen.getAllByText('90%')).toHaveLength(2);
  });

  it('labels a tie', () => {
    const g = base(side('a', 100, [['q1', 30]]), side('b', 100, [['q2', 30]]), null);
    wrap(<ScoreCard seasonTeams={{}} game={g} played managers={managers} players={players} to="/x" year={2025} />);
    expect(screen.getAllByText('Tie').length).toBeGreaterThan(0);
  });

  it('shows projections for an upcoming game and no performers', () => {
    const g = base(side('a', 0, []), side('b', 0, []), null);
    wrap(<ScoreCard seasonTeams={{}} game={g} played={false} managers={managers} players={players} to="/x" year={2025} />);
    expect(screen.getByText('Upcoming')).toBeInTheDocument();
    expect(screen.getAllByText('100.00')).toHaveLength(2);
    expect(screen.getAllByText('proj')).toHaveLength(2);
    expect(screen.queryByText('Top performers')).not.toBeInTheDocument();
    expect(screen.getByText('vs')).toBeInTheDocument();
    expect(screen.queryByText('Efficiency')).not.toBeInTheDocument();
    expect(screen.queryByText('Tie')).not.toBeInTheDocument();
  });

  it('shows the playoff tag and links to the box score', () => {
    const g = base(side('a', 100, [['q1', 30]]), side('b', 90, [['q2', 30]]), 'a', 'Final');
    wrap(<ScoreCard seasonTeams={{}} game={g} played managers={managers} players={players} to="/scores/2025/17/1" year={2025} />);
    expect(screen.getByText('Championship')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();
    // the cover link names both teams, so a reader tabbing through a scoreboard can tell the cards apart
    expect(screen.getByRole('link', { name: 'Team A vs Team B box score' })).toHaveAttribute('href', '/scores/2025/17/1');
  });

  it('links each team name to its team page and each manager to the career page', () => {
    const g = base(side('a', 100, [['q1', 30]]), side('b', 90, [['q2', 30]]), 'a');
    wrap(<ScoreCard seasonTeams={{}} game={g} played managers={managers} players={players} to="/scores/2025/3/1" year={2025} />);
    expect(screen.getByRole('link', { name: 'Team A' })).toHaveAttribute('href', '/teams/2025/a');
    expect(screen.getByRole('link', { name: 'Team B' })).toHaveAttribute('href', '/teams/2025/b');
    expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute('href', '/managers/a');
    expect(screen.getByRole('link', { name: 'bob' })).toHaveAttribute('href', '/managers/b');
    // the card itself still opens the box score, without nesting one link inside another
    expect(document.querySelectorAll('a a')).toHaveLength(0);
  });
});
