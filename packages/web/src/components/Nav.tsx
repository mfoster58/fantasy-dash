import { NavLink } from 'react-router';
import { leagueConfig } from '../../../../league.config';
import ThemeToggle from './ThemeToggle';

export const links: { to: string; label: string }[] = [
  { to: '/scores', label: 'Scores' },
  { to: '/standings', label: 'Standings' },
  { to: '/h2h', label: 'Head to Head' },
  { to: '/all-time', label: 'All-Time' },
];

export default function Nav() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-[1400px] items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-10">
        <NavLink to="/" className="shrink-0 whitespace-nowrap font-semibold tracking-tight">{leagueConfig.name}</NavLink>
        <nav className="flex h-full min-w-0 items-center gap-1 overflow-x-auto text-sm">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `relative flex h-12 shrink-0 items-center whitespace-nowrap px-1.5 transition-colors after:absolute after:inset-x-1.5 sm:px-2.5 sm:after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full ${isActive ? 'text-ink after:bg-accent' : 'text-muted after:bg-transparent hover:text-ink'}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto shrink-0"><ThemeToggle /></div>
      </div>
    </header>
  );
}
