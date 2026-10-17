import { fireEvent, render, screen, within } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router';
import Nav from './Nav';
import { currentSeason, history } from '../data/load';

describe('Nav', () => {
  it('toggles the narrow-screen menu and closes it on navigation', () => {
    render(<MemoryRouter><Nav /></MemoryRouter>);
    const button = screen.getByRole('button', { name: /^menu$/i });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByTestId('nav-menu');
    fireEvent.click(menu.querySelector('a[href="/standings"]')!);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the menu on any route change and on Escape', () => {
    render(<MemoryRouter><Nav /><Link to="/scores">elsewhere</Link></MemoryRouter>);
    const button = screen.getByRole('button', { name: /^menu$/i });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByText('elsewhere'));
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('has Rosters and Managers dropdown tabs where the Teams link used to be', () => {
    render(<MemoryRouter><Nav /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: 'Teams' })).toBeNull();
    const labels = within(screen.getAllByRole('navigation')[0]).queryAllByRole('link').map((l) => l.textContent)
      .concat(within(screen.getAllByRole('navigation')[0]).getAllByRole('button').map((b) => b.textContent));
    expect(labels).toContain('Rosters');
    expect(labels).toContain('Managers');
  });

  it('drops every manager from the Managers tab, in all-time order, linking to the career pages', () => {
    render(<MemoryRouter><Nav /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Managers' }));
    const panel = document.getElementById('nav-menu-managers')!;
    const hrefs = within(panel).getAllByRole('link').map((l) => l.getAttribute('href'));
    expect(hrefs).toEqual(history.allTime.map((r) => `/managers/${r.userId}`));
  });

  it('drops this season\'s teams from the Rosters tab once the season has loaded', async () => {
    render(<MemoryRouter><Nav /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Rosters' }));
    const panel = document.getElementById('nav-menu-rosters')!;
    const first = await within(panel).findAllByRole('link');
    expect(first.length).toBeGreaterThan(1);
    for (const l of first) expect(l.getAttribute('href')).toMatch(new RegExp(`^/teams/${currentSeason.year}/`));
  });

  it('lights the Rosters tab on a team page and the Managers tab on a manager page', () => {
    render(<MemoryRouter initialEntries={[`/teams/${currentSeason.year}/x`]}><Nav /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Rosters' })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('button', { name: 'Managers' })).not.toHaveAttribute('data-active');
  });

  it('puts the same two groups in the narrow-screen menu', () => {
    render(<MemoryRouter><Nav /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^menu$/i }));
    const menu = screen.getByTestId('nav-menu');
    fireEvent.click(within(menu).getByRole('button', { name: 'Managers' }));
    expect(within(menu).getAllByRole('link').some((l) => l.getAttribute('href')?.startsWith('/managers/'))).toBe(true);
  });

  it('links to Records and no longer to Player stats or All-Time', () => {
    render(<MemoryRouter><Nav /></MemoryRouter>);
    expect(screen.getAllByRole('link', { name: 'Records' })[0]).toHaveAttribute('href', '/records');
    expect(screen.queryByRole('link', { name: 'Player stats' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'All-Time' })).toBeNull();
  });
});
