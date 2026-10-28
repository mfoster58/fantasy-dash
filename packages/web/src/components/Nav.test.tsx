import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router';
import type { ReactElement } from 'react';
import Nav from './Nav';
import { currentSeason, history } from '../data/load';

/** Render, then let Nav's async Rosters load land inside act so it cannot warn from a later test. */
async function renderNav(ui: ReactElement) {
  const r = render(ui);
  await act(async () => {});
  return r;
}

describe('Nav', () => {
  it('puts Home, Scores, Standings, Players and More in a bar along the bottom of a phone', async () => {
    await renderNav(<MemoryRouter><Nav /></MemoryRouter>);
    const bar = screen.getByRole('navigation', { name: 'Sections' });
    expect(bar).toHaveClass('md:hidden');
    expect(bar).toHaveClass('fixed');
    const tabs = [...bar.querySelectorAll('a, button')].map((el) => el.textContent);
    expect(tabs).toEqual(['Home', 'Scores', 'Standings', 'Players', 'More']);
    expect(within(bar).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    expect(within(bar).getByRole('link', { name: 'Scores' })).toHaveAttribute('href', '/scores');
    expect(within(bar).getByRole('link', { name: 'Standings' })).toHaveAttribute('href', '/standings');
    expect(within(bar).getByRole('link', { name: 'Players' })).toHaveAttribute('href', '/players');
    // no hamburger at the top any more
    expect(screen.queryByRole('button', { name: /^menu$/i })).toBeNull();
  });

  it('lights the tab for the page you are on, Players for a player page too, and More for the pages inside it', async () => {
    const lit = async (path: string) => {
      const r = await renderNav(<MemoryRouter initialEntries={[path]}><Nav /></MemoryRouter>);
      const bar = screen.getByRole('navigation', { name: 'Sections' });
      const on = [...bar.querySelectorAll('[aria-current="page"], [data-active="true"]')].map((el) => el.textContent);
      r.unmount();
      return on;
    };
    expect(await lit('/')).toEqual(['Home']);
    expect(await lit('/scores/2026/7/1')).toEqual(['Scores']);
    expect(await lit('/player/9488')).toEqual(['Players']);
    expect(await lit('/players/compare')).toEqual(['More']);
    expect(await lit('/records')).toEqual(['More']);
  });

  it('More slides up a sheet with every other page, and closes on a pick, a route change, Escape or the backdrop', async () => {
    await renderNav(<MemoryRouter><Nav /><Link to="/scores">elsewhere</Link></MemoryRouter>);
    const more = screen.getByRole('button', { name: 'More' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    const sheet = screen.getByTestId('nav-menu');
    expect(within(sheet).getByRole('button', { name: 'Rosters' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Managers' })).toBeInTheDocument();
    for (const [name, href] of [['Comparison tool', '/players/compare'], ['Head to Head', '/h2h'], ['Records', '/records'], ['Stats', '/stats'], ['History', '/history'], ['Draft', '/draft']]) {
      expect(within(sheet).getByRole('link', { name })).toHaveAttribute('href', href);
    }
    fireEvent.click(within(sheet).getByRole('link', { name: 'Records' }));
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    fireEvent.click(screen.getByText('elsewhere'));
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    fireEvent.click(screen.getByTestId('nav-backdrop'));
    expect(more).toHaveAttribute('aria-expanded', 'false');
  });

  it('Players is a dropdown with Database and Comparison tool', async () => {
    await renderNav(<MemoryRouter initialEntries={['/players/compare']}><Nav /></MemoryRouter>);
    const bar = screen.getAllByRole('navigation')[0];
    expect(within(bar).queryByRole('link', { name: 'Players' })).toBeNull();
    const players = within(bar).getByRole('button', { name: 'Players' });
    expect(players).toHaveAttribute('data-active', 'true');
    fireEvent.click(players);
    const panel = document.getElementById('nav-menu-players')!;
    expect(within(panel).getByRole('link', { name: /Database/ })).toHaveAttribute('href', '/players');
    expect(within(panel).getByRole('link', { name: /Comparison tool/ })).toHaveAttribute('href', '/players/compare');
  });
  it('has Rosters and Managers dropdown tabs where the Teams link used to be', async () => {
    await renderNav(<MemoryRouter><Nav /></MemoryRouter>);
    expect(screen.queryByRole('link', { name: 'Teams' })).toBeNull();
    const labels = within(screen.getAllByRole('navigation')[0]).queryAllByRole('link').map((l) => l.textContent)
      .concat(within(screen.getAllByRole('navigation')[0]).getAllByRole('button').map((b) => b.textContent));
    expect(labels).toContain('Rosters');
    expect(labels).toContain('Managers');
  });

  it('drops every manager from the Managers tab, in all-time order, linking to the career pages', async () => {
    await renderNav(<MemoryRouter><Nav /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Managers' }));
    const panel = document.getElementById('nav-menu-managers')!;
    const hrefs = within(panel).getAllByRole('link').map((l) => l.getAttribute('href'));
    expect(hrefs).toEqual(history.allTime.map((r) => `/managers/${r.userId}`));
  });

  it('drops this season\'s teams from the Rosters tab once the season has loaded', async () => {
    await renderNav(<MemoryRouter><Nav /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Rosters' }));
    const panel = document.getElementById('nav-menu-rosters')!;
    const first = await within(panel).findAllByRole('link');
    expect(first.length).toBeGreaterThan(1);
    for (const l of first) expect(l.getAttribute('href')).toMatch(new RegExp(`^/teams/${currentSeason.year}/`));
  });

  it('lights the Rosters tab on a team page and the Managers tab on a manager page', async () => {
    await renderNav(<MemoryRouter initialEntries={[`/teams/${currentSeason.year}/x`]}><Nav /></MemoryRouter>);
    expect(screen.getByRole('button', { name: 'Rosters' })).toHaveAttribute('data-active', 'true');
    expect(screen.getByRole('button', { name: 'Managers' })).not.toHaveAttribute('data-active');
  });

  it('closes a pinned tab when the pointer moves onto the other one, so two panels are never open together', async () => {
    await renderNav(<MemoryRouter><Nav /></MemoryRouter>);
    const rosters = screen.getByRole('button', { name: 'Rosters' });
    const managers = screen.getByRole('button', { name: 'Managers' });
    fireEvent.click(rosters);
    expect(rosters).toHaveAttribute('aria-expanded', 'true');
    fireEvent.mouseEnter(managers.parentElement!);
    expect(managers).toHaveAttribute('aria-expanded', 'true');
    expect(rosters).toHaveAttribute('aria-expanded', 'false');
  });

  it('puts the same two groups in the More sheet', async () => {
    await renderNav(<MemoryRouter><Nav /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    const menu = screen.getByTestId('nav-menu');
    fireEvent.click(within(menu).getByRole('button', { name: 'Managers' }));
    expect(within(menu).getAllByRole('link').some((l) => l.getAttribute('href')?.startsWith('/managers/'))).toBe(true);
  });

  it('links to Records and no longer to Player stats or All-Time', async () => {
    await renderNav(<MemoryRouter><Nav /></MemoryRouter>);
    expect(screen.getAllByRole('link', { name: 'Records' })[0]).toHaveAttribute('href', '/records');
    expect(screen.getAllByRole('link', { name: 'Stats' })[0]).toHaveAttribute('href', '/stats');
    expect(screen.queryByRole('link', { name: 'Player stats' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'All-Time' })).toBeNull();
  });

  it('has a Players tab between Managers and Head to Head', async () => {
    await renderNav(<MemoryRouter><Nav /></MemoryRouter>);
    const nav = screen.getAllByRole('navigation')[0];
    const labels = [...nav.querySelectorAll('a, button')].map((el) => el.textContent).filter(Boolean);
    const i = labels.indexOf('Players');
    expect(i).toBeGreaterThan(0);
    expect(labels[i - 1]).toBe('Managers');
    expect(labels[i + 1]).toBe('Head to Head');
    // a dropdown now: Database and Comparison tool sit in its panel
    expect(within(nav).getByRole('button', { name: 'Players' })).toBeInTheDocument();
  });
});
