import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { H2HSeries, Manager } from '@fantasy-dash/core';
import HeadToHead from './HeadToHead';

const alice: Manager = { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 };
const bob: Manager = { userId: 'b', displayName: 'bob', teamName: 'Team B', avatar: null, rosterId: 2 };

// newest first; series.a is 'a'
const series: H2HSeries = {
  a: 'a', b: 'b', aWins: 2, bWins: 3, ties: 0,
  games: [
    { gameId: '2025-14-3', year: 2025, week: 14, tag: null, aPoints: 90, bPoints: 120 },  // after current game
    { gameId: '2025-10-2', year: 2025, week: 10, tag: null, aPoints: 80, bPoints: 100 },  // the current game
    { gameId: '2025-4-5', year: 2025, week: 4, tag: null, aPoints: 110, bPoints: 100 },
    { gameId: '2024-15-1', year: 2024, week: 15, tag: 'SF', aPoints: 95, bPoints: 105 },
    { gameId: '2024-2-4', year: 2024, week: 2, tag: null, aPoints: 120, bPoints: 101 },
    { gameId: '2024-1-6', year: 2024, week: 1, tag: null, aPoints: 130, bPoints: 99 },
  ],
  streak: { holder: null, length: 0 },
  totalPoints: { a: 0, b: 0 },
  biggestWin: null,
  closest: null,
  avgMargin: 0,
};

const wrap = (s: H2HSeries | undefined) =>
  render(<MemoryRouter><HeadToHead series={s} year={2025} week={10} left={bob} right={alice} /></MemoryRouter>);

describe('HeadToHead', () => {
  it('counts only meetings before this game, from the left manager’s side', () => {
    wrap(series);
    // prior: 2025 w4 (a), 2024 SF (b), 2024 w2 (a), 2024 w1 (a) -> bob 1, alice 3
    expect(screen.getByTestId('h2h-record')).toHaveTextContent(/^1\s*–\s*3$/);
    expect(screen.getByText('before this game')).toBeInTheDocument();
    expect(screen.getByText('4 prior meetings since 2024')).toBeInTheDocument();
  });

  it('lists at most three prior meetings, newest first, as links', () => {
    wrap(series);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/scores/2025/4/5', '/scores/2024/15/1', '/scores/2024/2/4']);
    expect(links[1]).toHaveTextContent('Semifinal');
    expect(links[0]).toHaveTextContent('2025 · Wk 4');
  });

  it('marks a first meeting', () => {
    wrap(undefined);
    expect(screen.getByTestId('h2h-record')).toHaveTextContent(/^0\s*–\s*0$/);
    expect(screen.getByText('First meeting')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
