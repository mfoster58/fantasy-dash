import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import RosterBreakdown, { orderPlayers } from './RosterBreakdown';
import { players } from '../../test/playerFixtures';
import type { PositionGroup, PositionPlayer } from '../../lib/teamProfile';

const pp = (playerId: string, position: string, started: number, starts: number, bench = 0, posRank: number | null = null): PositionPlayer =>
  ({ playerId, position, started, starts, high: started, bench, total: started + bench, ppg: starts ? Math.round((started / starts) * 100) / 100 : null, posRank });
const groups: PositionGroup[] = [
  { pos: 'QB', started: 60, roster: 60, share: 0.6, leagueShare: 0.3, rank: 1, players: [pp('q1', 'QB', 60, 4, 0, 3)] },
  { pos: 'RB', started: 40, roster: 52, share: 0.4, leagueShare: 0.5, rank: 3, players: [pp('r1', 'RB', 40, 2, 12)] },
  { pos: 'WR', started: 0, roster: 0, share: 0, leagueShare: 0.2, rank: 5, players: [] },
  { pos: 'TE', started: 0, roster: 0, share: 0, leagueShare: 0, rank: 5, players: [] },
  { pos: 'K', started: 0, roster: 0, share: 0, leagueShare: 0, rank: 5, players: [] },
  { pos: 'DEF', started: 0, roster: 0, share: 0, leagueShare: 0, rank: 5, players: [] },
];
const bench = ['w1', 't1', 'k1', 'KC', 'q1'].map((id, i) => pp(id, 'WR', 0, 0, 9 - i));

describe('RosterBreakdown', () => {
  it('draws the share bar, rank chips and position cards with started-most-weeks rows, position ranks and never-started lists', () => {
    render(<MemoryRouter><RosterBreakdown positions={groups} neverStarted={[pp('w1', 'WR', 0, 0, 9, 12)]} players={players} seasonTeams={{ q1: 'NYG' }} weeksPlayed={4} /></MemoryRouter>);
    expect(screen.getByTestId('share-QB')).toHaveTextContent('QB 60%');
    expect(screen.getByTestId('share-QB').style.width).toBe('60%');
    expect(screen.getByTestId('rank-QB')).toHaveTextContent('QB 1');
    expect(screen.getByTestId('rank-RB')).toHaveTextContent('RB 3');
    const qb = screen.getByTestId('group-QB');
    expect(within(qb).getByText('Quincy One')).toBeInTheDocument();
    expect(within(qb).getByText('NYG')).toBeInTheDocument();
    expect(within(qb).getByText('QB3')).toBeInTheDocument();
    expect(within(qb).getByText('Quincy One').closest('li')).toHaveAttribute('data-regular', 'true');   // 4 of 4 weeks
    const rb = screen.getByTestId('group-RB');
    expect(within(rb).getByText('Ricky One').closest('li')).toHaveAttribute('data-regular', 'true');    // 2 of 4 weeks is the threshold
    expect(within(rb).queryByText(/^RB\d/)).toBeNull();                                                  // no rank known
    const wr = screen.getByTestId('group-WR');
    expect(within(wr).getByText('Never started')).toBeInTheDocument();
    expect(within(wr).getByText('Wally One')).toBeInTheDocument();
    expect(within(wr).getByText('WR12')).toBeInTheDocument();
  });

  it('caps the never-started list at four with a show-more button', () => {
    render(<MemoryRouter><RosterBreakdown positions={groups} neverStarted={bench} players={players} seasonTeams={{}} weeksPlayed={4} /></MemoryRouter>);
    const wr = screen.getByTestId('group-WR');
    expect(within(wr).getAllByRole('listitem')).toHaveLength(4);
    fireEvent.click(within(wr).getByRole('button', { name: 'Show 1 more never started' }));
    expect(within(wr).getAllByRole('listitem')).toHaveLength(5);
  });

  it('switches to points per start, showing a dash for anyone under three starts', () => {
    render(<MemoryRouter><RosterBreakdown positions={groups} neverStarted={[]} players={players} seasonTeams={{}} weeksPlayed={4} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'PPG' }));
    expect(screen.getByRole('button', { name: 'PPG' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByTestId('group-QB')).getByText('15.00')).toBeInTheDocument();     // 60 over 4 starts
    const rb = within(screen.getByTestId('group-RB')).getByText('Ricky One').closest('li')!;
    expect(rb).toHaveTextContent('—');
    expect(rb).toHaveTextContent('2 starts');
    expect(rb).not.toHaveAttribute('data-regular');
  });
});

describe('orderPlayers', () => {
  it('ranks by points per start with the under-three-starts players trailing in start order', () => {
    const list = [pp('a', 'RB', 30, 3), pp('b', 'RB', 25, 1), pp('c', 'RB', 44, 4), pp('d', 'RB', 10, 2)];
    expect(orderPlayers(list, 'ppg').map((p) => p.playerId)).toEqual(['c', 'a', 'd', 'b']);   // 11.0, 10.0 | 2 starts, 1 start
    expect(orderPlayers(list, 'points')).toBe(list);
  });
});
