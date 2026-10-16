import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Game, GameSide, Manager, Week } from '@fantasy-dash/core';
import WeekScores, { weekScoreRows } from './WeekScores';

const managers: Record<string, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: null, avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: null, avatar: null, rosterId: 2 },
  c: { userId: 'c', displayName: 'cara', teamName: null, avatar: null, rosterId: 3 },
  d: { userId: 'd', displayName: 'dan', teamName: null, avatar: null, rosterId: 4 },
};
const side = (userId: string, points: number, projected: number, efficiency = 1): GameSide => ({
  userId, points, projected, ceiling: points, efficiency, starters: [], bench: [], optimalSwaps: [], recordBefore: { w: 0, l: 0, t: 0 }, seasonPpg: 100,
});
const game = (matchupId: number, x: GameSide, y: GameSide): Game => ({ id: `2025-3-${matchupId}`, matchupId, week: 3, tag: null, sides: [x, y], winner: null, margin: 0 });
const g1 = game(1, side('a', 120, 100, 0.9), side('b', 90, 110));
const g2 = game(2, side('c', 150, 95), side('d', 90, 105));
const week: Week = { week: 3, isPlayoff: false, played: true, games: [g1, g2], highScore: 'c' };

describe('weekScoreRows', () => {
  it('orders every team by points with ties sharing a rank and flags the viewed game', () => {
    const rows = weekScoreRows(week, g1);
    expect(rows.map((r) => [r.userId, r.rank, r.inGame])).toEqual([['c', 1, false], ['a', 2, true], ['b', 3, true], ['d', 3, false]]);
  });

  it('uses projections when the week is unplayed', () => {
    expect(weekScoreRows({ ...week, played: false }, g1).map((r) => r.userId)).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('WeekScores', () => {
  it('links each team to its game, marks the two in this game and summarises their rank', () => {
    render(<MemoryRouter><WeekScores week={week} game={g1} managers={managers} year={2025} /></MemoryRouter>);
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/scores/2025/3/2', '/scores/2025/3/1', '/scores/2025/3/1', '/scores/2025/3/2']);
    expect(links[1]).toHaveAttribute('aria-current', 'true');
    expect(links[0]).not.toHaveAttribute('aria-current');
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('Beats 1 of the other 2 teams')).toBeInTheDocument();
    expect(screen.getByText('Beats 0 of the other 2 teams')).toBeInTheDocument();
  });

  it('lists efficiency and skips the game summary on the scoreboard', () => {
    render(<MemoryRouter><WeekScores week={week} managers={managers} year={2025} /></MemoryRouter>);
    expect(screen.getAllByTestId('efficiency').map((e) => e.textContent)).toEqual(['100%', '90%', '100%', '100%']);
    expect(screen.queryByText(/of the other/)).toBeNull();
    expect(screen.queryByText(/^#\d/)).toBeNull();
    expect(screen.getByText('Week 3 · scores and efficiency')).toBeInTheDocument();
  });

  it('calls out the week high score', () => {
    render(<MemoryRouter><WeekScores week={week} game={g2} managers={managers} year={2025} /></MemoryRouter>);
    expect(screen.getByText('Highest score of the week')).toBeInTheDocument();
  });
});
