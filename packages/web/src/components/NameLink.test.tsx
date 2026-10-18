import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ManagerLink, PlayerLink, TeamLink } from './NameLink';

describe('NameLink', () => {
  it('a team name opens that season\'s team page', () => {
    render(<MemoryRouter><TeamLink userId="a" year={2025} className="font-medium">Team A</TeamLink></MemoryRouter>);
    const link = screen.getByRole('link', { name: 'Team A' });
    expect(link).toHaveAttribute('href', '/teams/2025/a');
    expect(link.className).toContain('font-medium');
    expect(link.className).toContain('hover:text-accent');
  });

  it('a manager name opens the career page', () => {
    render(<MemoryRouter><ManagerLink userId="a">alice</ManagerLink></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute('href', '/managers/a');
  });
  it('a player name opens the player page', () => {
    render(<MemoryRouter><PlayerLink id="4034">Christian McCaffrey</PlayerLink></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Christian McCaffrey' })).toHaveAttribute('href', '/player/4034');
  });
});
