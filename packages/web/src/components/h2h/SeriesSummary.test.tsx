import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { H2HSeries, History } from '@fantasy-dash/core';
import SeriesSummary from './SeriesSummary';

const managers: History['managers'] = {
  a: { displayName: 'alice', avatar: null, seasons: [2024, 2025] },
  b: { displayName: 'bob', avatar: null, seasons: [2024, 2025] },
};
const series: H2HSeries = {
  a: 'a', b: 'b', aWins: 3, bWins: 1, ties: 0,
  streak: { holder: 'a', length: 2 },
  totalPoints: { a: 500.5, b: 450.25 },
  biggestWin: { gameId: '2024-5-2', winner: 'b', margin: 40 },
  closest: { gameId: '2025-9-1', margin: 1.5 },
  avgMargin: 15.38,
  games: [],
};

describe('SeriesSummary', () => {
  it('orients the record to the selected pair and links the notable games', () => {
    render(<MemoryRouter><SeriesSummary series={series} a="b" b="a" managers={managers} /></MemoryRouter>);
    expect(screen.getByTestId('series-record')).toHaveTextContent('1 – 3');
    expect(screen.getByText(/alice has won 2 straight/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'bob' })).toHaveAttribute('href', '/managers/b');
    expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute('href', '/managers/a');
    expect(screen.getByText('450.25')).toBeInTheDocument();
    expect(screen.getByText('500.50')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /bob by 40\.00/ })).toHaveAttribute('href', '/scores/2024/5/2');
    expect(screen.getByRole('link', { name: /1\.50/ })).toHaveAttribute('href', '/scores/2025/9/1');
    expect(screen.getByText('15.38')).toBeInTheDocument();
  });

  it('handles a series with no games', () => {
    render(<MemoryRouter><SeriesSummary series={undefined} a="a" b="b" managers={managers} /></MemoryRouter>);
    expect(screen.getByText(/never met/i)).toBeInTheDocument();
  });
});
