import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Manager } from '@fantasy-dash/core';
import Schedule from './Schedule';
import type { ScheduleEntry } from '../../lib/teamProfile';

const managers: Record<string, Manager> = { b: { userId: 'b', displayName: 'bob', teamName: 'Bobcats', avatar: null, rosterId: 2 }, c: { userId: 'c', displayName: 'cara', teamName: null, avatar: null, rosterId: 3 } };
const entries: ScheduleEntry[] = [
  { kind: 'played', week: 1, tag: null, isPlayoff: false, matchupId: 1, opponentId: 'b', points: 120, oppPoints: 90, result: 'W', leagueAvg: 100, high: true, low: false },
  { kind: 'played', week: 2, tag: null, isPlayoff: false, matchupId: 2, opponentId: 'c', points: 95, oppPoints: 130, result: 'L', leagueAvg: 100, high: false, low: true },
  { kind: 'upcoming', week: 3, tag: null, isPlayoff: false, matchupId: 1, opponentId: 'b', projected: 118.4, oppProjected: 101.2 },
  { kind: 'bye', week: 15, leagueAvg: 100 },
  { kind: 'played', week: 16, tag: 'SF', isPlayoff: true, matchupId: 2, opponentId: 'c', points: 100, oppPoints: 99, result: 'W', leagueAvg: 100, high: false, low: false },
];

describe('Schedule', () => {
  it('lists played games with opponent, score, result pill and box score link', () => {
    render(<MemoryRouter><Schedule entries={entries} managers={managers} year={2025} /></MemoryRouter>);
    const games = screen.getAllByRole('link').filter((r) => r.getAttribute('href')!.startsWith('/scores'));
    expect(games.map((r) => r.getAttribute('href'))).toEqual(['/scores/2025/1/1', '/scores/2025/2/2', '/scores/2025/3/1', '/scores/2025/16/2']);
    // the opponent's name opens that team's page, above the row's game link
    expect(screen.getAllByRole('link', { name: 'Bobcats' })[0]).toHaveAttribute('href', '/teams/2025/b');
    expect(screen.getAllByRole('link', { name: 'cara' })[0]).toHaveAttribute('href', '/teams/2025/c');
    expect(document.querySelectorAll('a a')).toHaveLength(0);
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Bobcats');
    expect(rows[0]).toHaveTextContent('W');
    expect(rows[0]).not.toHaveTextContent(/season high|▲/i);
    expect(rows[1]).toHaveTextContent('cara');
    expect(rows[1]).not.toHaveTextContent(/season low|▼/i);
    expect(rows[4]).toHaveTextContent('Semifinal');   // rows include the week 15 bye
  });

  it('shows upcoming games with projections and playoff byes', () => {
    render(<MemoryRouter><Schedule entries={entries} managers={managers} year={2025} /></MemoryRouter>);
    const upcoming = screen.getAllByRole('listitem')[2];
    expect(upcoming).toHaveTextContent('Bobcats');
    expect(upcoming).toHaveTextContent('118.4');
    expect(upcoming).toHaveTextContent('proj');
    expect(screen.getByText('Bye')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('says so when nothing is scheduled', () => {
    render(<MemoryRouter><Schedule entries={[]} managers={managers} year={2025} /></MemoryRouter>);
    expect(screen.getByText('No games scheduled yet.')).toBeInTheDocument();
  });
});
