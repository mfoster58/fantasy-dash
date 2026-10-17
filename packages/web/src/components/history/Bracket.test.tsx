import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { BracketGame, Manager } from '@fantasy-dash/core';
import Bracket from './Bracket';

const managers: Record<string, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: 'Team B', avatar: null, rosterId: 2 },
  c: { userId: 'c', displayName: 'cara', teamName: 'Team C', avatar: null, rosterId: 3 },
};
const g = (o: Partial<BracketGame>): BracketGame => ({
  bracket: 'winners', round: 1, matchNo: 1, placement: null, week: 15, tag: 'QF',
  home: 'a', away: 'b', homePoints: 120.5, awayPoints: 99.25, advanced: 'a', gameId: '2025-15-1', ...o,
});

describe('Bracket', () => {
  it('groups games by round, marks winners, labels placement games and links box scores', () => {
    render(<MemoryRouter><Bracket kind="winners" year={2025} managers={managers} games={[
      g({}),
      g({ round: 2, matchNo: 2, week: 16, tag: 'Final', placement: 1, home: 'a', away: 'c', homePoints: 140, awayPoints: 150.75, advanced: 'c', gameId: '2025-16-3' }),
      g({ round: 2, matchNo: 3, week: 16, tag: '3rd', placement: 3, home: 'b', away: null, homePoints: null, awayPoints: null, advanced: null, gameId: null }),
    ]} /></MemoryRouter>);
    expect(screen.getByText('Quarterfinal')).toBeInTheDocument();
    expect(screen.getByText('Championship')).toBeInTheDocument();
    expect(screen.getByText('3rd place')).toBeInTheDocument();
    expect(screen.getByText('TBD')).toBeInTheDocument();
    // each cover link names the game, so a reader tabbing through the bracket can tell the cards apart
    expect(screen.getByRole('link', { name: 'Quarterfinal: Team A vs Team B box score' })).toHaveAttribute('href', '/scores/2025/15/1');
    expect(screen.getByRole('link', { name: 'Championship: Team A vs Team C box score' })).toHaveAttribute('href', '/scores/2025/16/3');
    // every team name opens that season's team page, above the game's own link; the unplayed game has no game link
    expect(screen.getAllByRole('link', { name: 'Team A' }).map((l) => l.getAttribute('href'))).toEqual(['/teams/2025/a', '/teams/2025/a']);
    expect(screen.getByRole('link', { name: 'Team C' })).toHaveAttribute('href', '/teams/2025/c');
    expect(document.querySelectorAll('a a')).toHaveLength(0);
  });

  it('consolation: the higher scorer is the winner even though the lower scorer advances', () => {
    render(<MemoryRouter><Bracket kind="consolation" year={2025} managers={managers} games={[
      g({ bracket: 'consolation', tag: 'Toilet Bowl', placement: 1, round: 2, week: 16, home: 'a', away: 'b', homePoints: 115.94, awayPoints: 161.8, advanced: 'a', gameId: '2025-16-9' }),
    ]} /></MemoryRouter>);
    const rowB = screen.getByText('Team B').closest('div')!;
    const rowA = screen.getByText('Team A').closest('div')!;
    expect(rowB).toHaveTextContent('161.80');
    expect(rowB).toHaveTextContent('winner');
    expect(rowA).not.toHaveTextContent('winner');
  });
});
