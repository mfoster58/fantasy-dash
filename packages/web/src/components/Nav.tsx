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
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center gap-6 px-4">
        <NavLink to="/" className="font-semibold tracking-tight">{leagueConfig.name}</NavLink>
        <nav className="flex items-center gap-1 text-sm">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded px-2.5 py-1 transition-colors ${isActive ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'}`}
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
