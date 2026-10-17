import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router';
import NavMenu, { NavMenuGroup } from './NavMenu';
import type { MenuEntry } from '../lib/navMenus';

const entries: MenuEntry[] = [
  { userId: 'b', title: 'Team Bob', subtitle: 'bob', avatar: null, to: '/teams/2025/b' },
  { userId: 'a', title: 'Team Alice', subtitle: 'alice', avatar: null, to: '/teams/2025/a' },
];

const setup = (active = false) => render(
  <MemoryRouter>
    <NavMenu id="rosters" label="Rosters" active={active} entries={entries} />
    <Link to="/scores">elsewhere</Link>
  </MemoryRouter>,
);

describe('NavMenu', () => {
  it('opens on click with one link per entry, title and subtitle, and closes on a second click', () => {
    setup();
    const button = screen.getByRole('button', { name: 'Rosters' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: /Team Bob/ })).toBeNull();
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const links = screen.getAllByRole('link').filter((l) => l.textContent !== 'elsewhere');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/teams/2025/b', '/teams/2025/a']);
    expect(links[0]).toHaveTextContent('Team Bob');
    expect(links[0]).toHaveTextContent('bob');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens while hovered and closes when the pointer leaves', () => {
    setup();
    const button = screen.getByRole('button', { name: 'Rosters' });
    const wrap = button.parentElement!;
    fireEvent.mouseEnter(wrap);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.mouseLeave(wrap);
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('a click keeps it open after the pointer leaves, and Escape, an outside press or navigation closes it', () => {
    setup();
    const button = screen.getByRole('button', { name: 'Rosters' });
    const wrap = button.parentElement!;
    fireEvent.mouseEnter(wrap);
    fireEvent.click(button);
    fireEvent.mouseLeave(wrap);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    fireEvent.mouseDown(document.body);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    fireEvent.click(screen.getByText('elsewhere'));
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('marks the tab active for the section it leads to', () => {
    setup(true);
    expect(screen.getByRole('button', { name: 'Rosters' })).toHaveAttribute('data-active', 'true');
  });

  it('says so while the entries are still loading', () => {
    render(<MemoryRouter><NavMenu id="rosters" label="Rosters" active={false} entries={[]} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Rosters' }));
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});

describe('NavMenuGroup', () => {
  it('is a collapsed group in the narrow-screen menu that expands to the same links', () => {
    render(<MemoryRouter><NavMenuGroup label="Rosters" active={false} entries={entries} onNavigate={() => {}} /></MemoryRouter>);
    const button = screen.getByRole('button', { name: 'Rosters' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link')).toBeNull();
    fireEvent.click(button);
    expect(screen.getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['/teams/2025/b', '/teams/2025/a']);
  });

  it('tells the sheet when an entry is picked', () => {
    const onNavigate = vi.fn();
    render(<MemoryRouter><NavMenuGroup label="Rosters" active={false} entries={entries} onNavigate={onNavigate} /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Rosters' }));
    fireEvent.click(screen.getByRole('link', { name: /Team Alice/ }));
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
