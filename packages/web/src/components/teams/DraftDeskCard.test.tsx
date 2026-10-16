import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { DraftPick } from '@fantasy-dash/core';
import DraftDeskCard from './DraftDeskCard';
import { players } from '../../test/playerFixtures';
import type { DeskPick, DraftDesk } from '../../lib/teamProfile';

const pick = (playerId: string, round: number, pickNo: number, value: number): DeskPick => ({
  round, pickNo, slot: 1, userId: 'a', playerId, isKeeper: false, posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: true,
  pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value, tradedTo: null, teams: 10,
} satisfies DraftPick & { teams: number });
const desk: DraftDesk = {
  drafts: 2, avgGrade: 'B+', valuePerDraft: 120.5,
  seasons: [
    { year: 2025, grade: 'A', value: 200, rank: 1, teams: 10, steal: pick('q1', 6, 58, 110), bust: pick('r1', 1, 1, -40) },
    { year: 2024, grade: 'C', value: 41, rank: 6, teams: 10, steal: null, bust: null },
  ],
};

describe('DraftDeskCard', () => {
  it('shows the average grade and value per draft, then a row per year with grade, value, biggest steal and biggest bust', () => {
    render(<MemoryRouter><DraftDeskCard desk={desk} players={players} /></MemoryRouter>);
    expect(screen.getByText('B+')).toBeInTheDocument();
    expect(screen.getByText('+121')).toBeInTheDocument();
    expect(screen.getByText('value per draft')).toBeInTheDocument();
    expect(screen.queryByText(/career/)).toBeNull();
    expect(screen.getByText('Biggest steal')).toBeInTheDocument();
    expect(screen.getByText('Biggest bust')).toBeInTheDocument();
    const row = screen.getByTestId('draft-2025');
    expect(within(row).getByRole('link', { name: '2025' })).toHaveAttribute('href', '/draft/2025');
    expect(within(row).getByText('A')).toBeInTheDocument();
    expect(within(row).getByText('+200')).toBeInTheDocument();
    expect(within(row).getByText('Quincy One')).toBeInTheDocument();
    expect(within(row).getByText('pick 6.08')).toBeInTheDocument();
    expect(within(row).getByText('+110')).toBeInTheDocument();
    expect(within(row).getByText('Ricky One')).toBeInTheDocument();
    expect(within(row).getByText('-40')).toBeInTheDocument();
    expect(within(screen.getByTestId('draft-2024')).getAllByText('—')).toHaveLength(2);
  });
});
