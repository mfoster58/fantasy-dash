import { useState } from 'react';
import { NavLink } from 'react-router';
import { leagueConfig } from '../../../../league.config';
import ThemeToggle from './ThemeToggle';

export const links: { to: string; label: string }[] = [
  { to: '/scores', label: 'Scores' },
  { to: '/standings', label: 'Standings' },
  { to: '/h2h', label: 'Head to Head' },
  { to: '/all-time', label: 'All-Time' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `relative flex h-12 shrink-0 items-center whitespace-nowrap px-2.5 transition-colors after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full ${isActive ? 'text-ink after:bg-accent' : 'text-muted after:bg-transparent hover:text-ink'}`;

export default function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-[1400px] items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-10">
        <NavLink to="/" className="shrink-0 whitespace-nowrap font-semibold tracking-tight" onClick={() => setOpen(false)}>{leagueConfig.name}</NavLink>
        <nav className="hidden h-full min-w-0 items-center gap-1 text-sm md:flex">
          {links.map((l) => <NavLink key={l.to} to={l.to} className={linkClass}>{l.label}</NavLink>)}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="nav-menu"
            onClick={() => setOpen((o) => !o)}
            className="rounded px-2 py-1 text-xs text-muted hover:text-ink md:hidden"
          >
            {open ? 'Close' : 'Menu'}
          </button>
        </div>
      </div>
      {open && (
        <div id="nav-menu" data-testid="nav-menu" className="border-t border-line bg-bg md:hidden">
          <nav className="mx-auto flex max-w-[1400px] flex-col px-2 py-1 text-sm">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `rounded px-3 py-2 ${isActive ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'}`}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
