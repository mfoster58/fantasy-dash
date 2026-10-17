import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Manager } from '@fantasy-dash/core';
import TopStarts from './TopStarts';
import { players } from '../../test/playerFixtures';
import type { BestStart } from '../../lib/teamProfile';

const managers: Record<string, Manager> = { b: { userId: 'b', displayName: 'bob', teamName: 'Bobcats', avatar: null, rosterId: 2 } };
const rows: BestStart[] = [
  { playerId: 'q1', week: 10, matchupId: 3, opponentId: 'b', tag: null, points: 41.2, waiver: false },
  { playerId: 'r1', week: 16, matchupId: 1, opponentId: 'b', tag: 'SF', points: 30.5, waiver: true },
];

describe('TopStarts', () => {
  it('lists each start with the player, week, opponent and points, linking to the box score', () => {
    render(<MemoryRouter><TopStarts label="Single-week highs" title="Best starts" rows={rows} empty="Nothing started yet." players={players} seasonTeams={{ q1: 'DEN' }} managers={managers} year={2025} /></MemoryRouter>);
    const games = screen.getAllByRole('link').filter((l) => l.getAttribute('href')!.startsWith('/scores'));
    expect(games.map((l) => l.getAttribute('href'))).toEqual(['/scores/2025/10/3', '/scores/2025/16/1']);
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Quincy One');
    expect(items[0]).toHaveTextContent('DEN');
    expect(items[0]).toHaveTextContent('Week 10 vs Bobcats');
    expect(items[0]).toHaveTextContent('41.20');
    expect(items[1]).toHaveTextContent('Semifinal');
    // the opponent's name opens that team's page, above the row's game link
    expect(screen.getAllByRole('link', { name: 'Bobcats' })[0]).toHaveAttribute('href', '/teams/2025/b');
    expect(document.querySelectorAll('a a')).toHaveLength(0);
  });

  it('shows the empty message when there are no rows', () => {
    render(<MemoryRouter><TopStarts label="Waivers" title="Best waiver starts" rows={[]} empty="No pickup has started yet." players={players} seasonTeams={{}} managers={managers} year={2025} /></MemoryRouter>);
    expect(screen.getByText('No pickup has started yet.')).toBeInTheDocument();
  });
});
