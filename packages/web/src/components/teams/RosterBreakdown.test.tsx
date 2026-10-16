import { render, screen, within } from '@testing-library/react';
import RosterBreakdown from './RosterBreakdown';
import { players } from '../../test/playerFixtures';
import type { PositionGroup, PositionPlayer } from '../../lib/teamProfile';

const pp = (playerId: string, position: string, started: number, starts: number, bench = 0): PositionPlayer => ({ playerId, position, started, starts, high: started, bench, total: started + bench });
const groups: PositionGroup[] = [
  { pos: 'QB', started: 60, roster: 60, share: 0.6, leagueShare: 0.3, rank: 1, players: [pp('q1', 'QB', 60, 4)] },
  { pos: 'RB', started: 40, roster: 52, share: 0.4, leagueShare: 0.5, rank: 3, players: [pp('r1', 'RB', 40, 2, 12)] },
  { pos: 'WR', started: 0, roster: 0, share: 0, leagueShare: 0.2, rank: 5, players: [] },
  { pos: 'TE', started: 0, roster: 0, share: 0, leagueShare: 0, rank: 5, players: [] },
  { pos: 'K', started: 0, roster: 0, share: 0, leagueShare: 0, rank: 5, players: [] },
  { pos: 'DEF', started: 0, roster: 0, share: 0, leagueShare: 0, rank: 5, players: [] },
];

describe('RosterBreakdown', () => {
  it('draws the share bar, rank chips and position cards with started-most-weeks rows and never-started lists', () => {
    render(<RosterBreakdown positions={groups} neverStarted={[pp('w1', 'WR', 0, 0, 9)]} players={players} seasonTeams={{ q1: 'NYG' }} weeksPlayed={4} />);
    expect(screen.getByTestId('share-QB')).toHaveTextContent('QB 60%');
    expect(screen.getByTestId('share-QB').style.width).toBe('60%');
    expect(screen.getByTestId('rank-QB')).toHaveTextContent('QB 1');
    expect(screen.getByTestId('rank-RB')).toHaveTextContent('RB 3');
    const qb = screen.getByTestId('group-QB');
    expect(within(qb).getByText('Quincy One')).toBeInTheDocument();
    expect(within(qb).getByText('NYG')).toBeInTheDocument();
    expect(within(qb).getByText('Quincy One').closest('li')).toHaveAttribute('data-regular', 'true');   // 4 of 4 weeks
    const rb = screen.getByTestId('group-RB');
    expect(within(rb).getByText('Ricky One').closest('li')).toHaveAttribute('data-regular', 'true');    // 2 of 4 weeks is the threshold
    const wr = screen.getByTestId('group-WR');
    expect(within(wr).getByText('Never started')).toBeInTheDocument();
    expect(within(wr).getByText('Wally One')).toBeInTheDocument();
  });
});
