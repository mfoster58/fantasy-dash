import { NavLink } from 'react-router';
import { leagueConfig } from '../../../../league.config';
import ThemeToggle from './ThemeToggle';

export const links: { to: string; label: string }[] = [
  { to: '/scores', label: 'Scores' },
  { to: '/standings', label: 'Standings' },
];

export default function Nav() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-[1400px] items-center gap-6 px-4 sm:px-6 lg:px-10">
        <NavLink to="/" className="font-semibold tracking-tight">{leagueConfig.name}</NavLink>
        <nav className="flex h-full items-center gap-1 text-sm">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `relative flex h-12 items-center px-2.5 transition-colors after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full ${isActive ? 'text-ink after:bg-accent' : 'text-muted after:bg-transparent hover:text-ink'}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto"><ThemeToggle /></div>
      </div>
    </header>
  );
}
