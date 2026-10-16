import { fireEvent, render, screen } from '@testing-library/react';
import FranchisePlayers from './FranchisePlayers';
import { players } from '../../test/playerFixtures';
import type { FranchisePlayer } from '../../lib/teamProfile';

const fp = (playerId: string, weeks: number): FranchisePlayer => ({ playerId, position: 'WR', from: 2024, to: 2025, seasons: 2, weeks, starts: weeks, started: weeks * 10, high: 20 });

describe('FranchisePlayers', () => {
  it('shows six players and the rest behind a button', () => {
    const list = ['q1', 'r1', 'w1', 't1', 'k1', 'KC', 'q2', 'r2'].map((id, i) => fp(id, 30 - i));
    render(<FranchisePlayers players={players} franchise={list} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('has no button when six or fewer', () => {
    render(<FranchisePlayers players={players} franchise={[fp('q1', 5)]} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Quincy One')).toBeInTheDocument();
  });
});
