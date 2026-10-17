import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Draft, DraftPick, PlayerDirectory, Season } from '@fantasy-dash/core';
import { GradingGuide } from './GradingPage';

const players: PlayerDirectory = {
  p1: { id: 'p1', name: 'Star Back', firstName: 'Star', lastName: 'Back', position: 'RB', team: 'SF', yearsExp: 3 },
  p2: { id: 'p2', name: 'Bust Wide', firstName: 'Bust', lastName: 'Wide', position: 'WR', team: 'DAL', yearsExp: 3 },
  p3: { id: 'p3', name: 'Late Gem', firstName: 'Late', lastName: 'Gem', position: 'TE', team: 'KC', yearsExp: 3 },
  p4: { id: 'p4', name: 'Dart Miss', firstName: 'Dart', lastName: 'Miss', position: 'WR', team: 'NYJ', yearsExp: 1 },
};
const pick = (pickNo: number, userId: string, playerId: string, contribution: number, earnedPick: number | null, value: number, seasonPoints = 200): DraftPick => ({
  round: Math.ceil(pickNo / 2), pickNo, slot: ((pickNo - 1) % 2) + 1, userId, playerId, isKeeper: false,
  posDraftRank: 1, seasonPoints, gamesPlayed: 17, ppg: seasonPoints / 17, healthy: true,
  pointsOverBaseline: contribution, redraftPos: 1, contribution, earnedPick, value, tradedTo: null,
});
const draft: Draft = {
  draftId: 'D', type: 'snake', rounds: 15, slotOrder: ['a', 'b'], expectedCurve: { a: 120, k: 30, c: -20 },
  baselines: { RB: { baselineRank: 24, baselinePoints: 150, benchRank: 40, benchPoints: 110 }, WR: { baselineRank: 24, baselinePoints: 170, benchRank: 40, benchPoints: 140 } },
  picks: [pick(1, 'a', 'p1', 180, -12, 25, 330), pick(2, 'b', 'p2', -30, null, -98, 60), pick(55, 'a', 'p3', 60, 5, 60), pick(26, 'b', 'p4', -30, null, -4, 10)],
};
const season = {
  year: 2025, status: 'complete', draft,
  managers: { a: { userId: 'a', displayName: 'alice', teamName: 'A', avatar: null, rosterId: 1 }, b: { userId: 'b', displayName: 'bob', teamName: 'B', avatar: null, rosterId: 2 } },
} as unknown as Season;

describe('GradingGuide', () => {
  it('walks through the steps with the season\'s baselines, examples, charts and grades', () => {
    render(<MemoryRouter><GradingGuide season={season} players={players} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'How grading works' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '2025 draft' })).toHaveAttribute('href', '/draft/2025');
    expect(screen.getByText('RB24')).toBeInTheDocument();
    expect(screen.getByText('× 0.65')).toBeInTheDocument();                   // the running back market weight beside its baseline row
    expect(screen.getByText(/tight ends count at 50%, quarterbacks and running backs at 65%/)).toBeInTheDocument();
    expect(screen.getByText('150.0')).toBeInTheDocument();
    expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(2);     // two charts
    expect(screen.getByText('ceiling 150')).toBeInTheDocument();             // bounded earned capital before pick 1
    const table = screen.getByText('Most productive player').closest('table')!;
    expect(table).toHaveTextContent('Star Back');
    expect(within(table).getAllByRole('link', { name: 'alice' })[0]).toHaveAttribute('href', '/managers/a');
    expect(table).toHaveTextContent('Biggest bust');
    expect(table).toHaveTextContent('off the board');
    expect(table).toHaveTextContent('+60.0');
    expect(table).toHaveTextContent('×1.20');                                 // surplus premium at pick 55
    const grades = screen.getByRole('list').querySelectorAll('li');
    expect(grades).toHaveLength(2);
    expect(grades[0]).toHaveTextContent('alice');
    expect(within(grades[0]).getByRole('link', { name: 'alice' })).toHaveAttribute('href', '/managers/a');
    expect(grades[0]).toHaveTextContent('+85');
    expect(grades[0]).toHaveTextContent('A+');
    expect(grades[1]).toHaveTextContent('bob');
    expect(grades[1]).toHaveTextContent('-102');
  });
});
