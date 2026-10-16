import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Manager } from '@fantasy-dash/core';
import Schedule from './Schedule';
import type { WeekLine } from '../../lib/teamProfile';

const managers: Record<string, Manager> = { b: { userId: 'b', displayName: 'bob', teamName: 'Bobcats', avatar: null, rosterId: 2 }, c: { userId: 'c', displayName: 'cara', teamName: null, avatar: null, rosterId: 3 } };
const weeks: WeekLine[] = [
  { week: 1, tag: null, isPlayoff: false, matchupId: 1, opponentId: 'b', points: 120, oppPoints: 90, result: 'W', leagueAvg: 100, high: true, low: false },
  { week: 15, tag: 'SF', isPlayoff: true, matchupId: 2, opponentId: 'c', points: 95, oppPoints: 130, result: 'L', leagueAvg: 100, high: false, low: true },
];

describe('Schedule', () => {
  it('lists each game with opponent, bold own score, high/low marks, result pill and box score link', () => {
    render(<MemoryRouter><Schedule weeks={weeks} managers={managers} year={2025} /></MemoryRouter>);
    const rows = screen.getAllByRole('link');
    expect(rows.map((r) => r.getAttribute('href'))).toEqual(['/scores/2025/1/1', '/scores/2025/15/2']);
    expect(rows[0]).toHaveTextContent('Bobcats');
    expect(rows[0]).toHaveTextContent('▲');
    expect(rows[0]).toHaveTextContent('W');
    expect(rows[1]).toHaveTextContent('cara');
    expect(rows[1]).toHaveTextContent('Semifinal');
    expect(rows[1]).toHaveTextContent('▼');
  });

  it('says so when nothing has been played', () => {
    render(<MemoryRouter><Schedule weeks={[]} managers={managers} year={2025} /></MemoryRouter>);
    expect(screen.getByText('No games played yet.')).toBeInTheDocument();
  });
});
