import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import AllTimeTeam from './AllTimeTeam';
import { players } from '../../test/playerFixtures';
import type { AllTimeTeam as Team } from '../../lib/allTimeTeam';

const team: Team = {
  season: [
    { slot: 'QB', pick: { playerId: 'q1', position: 'QB', year: 2024, points: 350.5, games: 17, ppg: 20.62, posRank: 3 } },
    { slot: 'RB', pick: null }, { slot: 'RB', pick: null }, { slot: 'WR', pick: null }, { slot: 'WR', pick: null }, { slot: 'TE', pick: null }, { slot: 'FLEX', pick: null }, { slot: 'DEF', pick: null }, { slot: 'K', pick: null },
  ],
  game: [
    { slot: 'QB', pick: { playerId: 'q1', position: 'QB', year: 2025, week: 9, matchupId: 4, tag: null, points: 44.1, stats: { pass_cmp: 25, pass_att: 33, pass_yd: 402, pass_td: 4 } } },
    { slot: 'RB', pick: { playerId: 'r1', position: 'RB', year: 2023, week: 15, matchupId: 2, tag: 'QF', points: 38, stats: { rush_att: 22, rush_yd: 180, rush_td: 2 } } },
    { slot: 'RB', pick: null }, { slot: 'WR', pick: null }, { slot: 'WR', pick: null }, { slot: 'TE', pick: null }, { slot: 'FLEX', pick: null }, { slot: 'DEF', pick: null }, { slot: 'K', pick: null },
  ],
};

describe('AllTimeTeam', () => {
  it('lists every slot for the best seasons with points, PPG and position rank, then switches to single games linking the box score', () => {
    render(<MemoryRouter><AllTimeTeam team={team} players={players} userId="u" /></MemoryRouter>);
    expect(screen.getAllByRole('listitem')).toHaveLength(9);
    expect(screen.getByText('Quincy One').closest('a')).toHaveAttribute('href', '/teams/2024/u');
    expect(screen.getByText('QB3')).toBeInTheDocument();
    expect(screen.getByText('350.50')).toBeInTheDocument();
    expect(screen.getByText('20.6 PPG')).toBeInTheDocument();
    expect(screen.getByText('2024 · 17 games')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Single game' }));
    expect(screen.getByText('Quincy One').closest('a')).toHaveAttribute('href', '/scores/2025/9/4');
    expect(screen.getByText('44.10')).toBeInTheDocument();
    expect(screen.getByText('2023 · Week 15 · Quarterfinal')).toBeInTheDocument();
    expect(screen.queryByText(/on the bench/)).toBeNull();
    // each game's stat line, and the lineup's total
    expect(screen.getByText(/402 yds/)).toBeInTheDocument();
    expect(screen.getByText(/180 yds/)).toBeInTheDocument();
    expect(screen.getByTestId('lineup-total')).toHaveTextContent('82.10');
    expect(screen.queryByText('QB3')).toBeNull();
  });
});
