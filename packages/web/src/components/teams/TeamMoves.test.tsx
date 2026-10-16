import { fireEvent, render, screen } from '@testing-library/react';
import type { Transaction } from '@fantasy-dash/core';
import TeamMoves from './TeamMoves';
import { players } from '../../test/playerFixtures';

const DAY = 86_400_000;
const tx = (i: number, day: number): Transaction => ({ id: `t${i}`, type: 'free_agent', week: 1, created: Date.UTC(2025, 8, 1, 12) + day * DAY, adds: [{ playerId: 'r1', userId: 'a' }], drops: [], bid: null });
// eight moves on seven distinct days, newest first
const moves = [tx(1, 7), tx(2, 6), tx(3, 6), tx(4, 5), tx(5, 4), tx(6, 3), tx(7, 2), tx(8, 1)];

describe('TeamMoves', () => {
  it('shows the five most recent days and folds the rest behind a see-more button', () => {
    render(<TeamMoves moves={moves} bestPickup={null} players={players} seasonTeams={{}} managers={{}} userId="a" />);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    const more = screen.getByRole('button', { name: /See 2 more moves/ });
    fireEvent.click(more);
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Show recent only' })).toBeInTheDocument();
  });

  it('has no see-more button when everything fits', () => {
    render(<TeamMoves moves={moves.slice(0, 3)} bestPickup={null} players={players} seasonTeams={{}} managers={{}} userId="a" />);
    expect(screen.queryByRole('button', { name: /more move/ })).toBeNull();
  });
});
