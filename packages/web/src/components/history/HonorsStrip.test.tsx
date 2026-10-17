import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Honors, Manager } from '@fantasy-dash/core';
import HonorsStrip from './HonorsStrip';

const managers: Record<string, Manager> = {
  a: { userId: 'a', displayName: 'alice', teamName: 'Team A', avatar: null, rosterId: 1 },
  b: { userId: 'b', displayName: 'bob', teamName: null, avatar: null, rosterId: 2 },
};
const honors: Honors = { champion: 'a', runnerUp: 'b', third: null, pointsTitle: 'a', lastPlace: 'b' };

describe('HonorsStrip', () => {
  it('links the team name to that season\'s team page and the manager to the career page', () => {
    render(<MemoryRouter><HonorsStrip honors={honors} managers={managers} status="complete" lastScoredWeek={17} year={2025} /></MemoryRouter>);
    expect(screen.getAllByRole('link', { name: 'Team A' })[0]).toHaveAttribute('href', '/teams/2025/a');
    expect(screen.getAllByRole('link', { name: 'alice' })[0]).toHaveAttribute('href', '/managers/a');
    // no team name: the manager's name stands for the team and opens the team page
    expect(screen.getAllByRole('link', { name: 'bob' })[0]).toHaveAttribute('href', '/teams/2025/b');
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('waits for the playoffs during the season', () => {
    render(<MemoryRouter><HonorsStrip honors={honors} managers={managers} status="in_season" lastScoredWeek={6} year={2026} /></MemoryRouter>);
    expect(screen.getByText(/through week 6/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
