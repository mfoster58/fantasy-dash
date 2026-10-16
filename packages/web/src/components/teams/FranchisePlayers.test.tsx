import { fireEvent, render, screen } from '@testing-library/react';
import FranchisePlayers from './FranchisePlayers';
import { players } from '../../test/playerFixtures';
import type { FranchisePlayer } from '../../lib/teamProfile';

const fp = (playerId: string, position: string, started: number): FranchisePlayer => ({ playerId, position, from: 2024, to: 2025, seasons: 2, weeks: 20, starts: 10, started, high: 20 });

describe('FranchisePlayers', () => {
  it('shows the top ten in the order given and filters by position', () => {
    const list = [fp('q1', 'QB', 300), ...Array.from({ length: 11 }, (_, i) => fp(`w${i + 1}`, 'WR', 200 - i)), fp('r1', 'RB', 50)];
    render(<FranchisePlayers players={players} franchise={list} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText('Quincy One')).toBeInTheDocument();
    expect(screen.queryByText('Ricky One')).toBeNull();     // 13th by points
    expect(screen.queryByRole('button', { name: /more/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'RB' }));
    expect(screen.getByRole('button', { name: 'RB' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('Ricky One')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'TE' }));
    expect(screen.getByText('Nobody rostered yet.')).toBeInTheDocument();
  });
});
