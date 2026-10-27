import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { leagueConfig } from '../../../../league.config';
import { currentSeason, history, loadSeason } from '../data/load';
import { managerEntries, playerEntries, rosterEntries } from '../lib/navMenus';
import NavMenu, { NavMenuGroup, type MenuEntries } from './NavMenu';
import ThemeToggle from './ThemeToggle';

type Item =
  | { kind: 'link'; to: string; label: string }
  | { kind: 'menu'; id: MenuId; label: string; prefix: string };
type MenuId = 'rosters' | 'managers' | 'players';

/** The top-bar tabs in order; the menus drop a list of pages instead of leading anywhere themselves. */
export const items: Item[] = [
  { kind: 'link', to: '/scores', label: 'Scores' },
  { kind: 'link', to: '/standings', label: 'Standings' },
  { kind: 'menu', id: 'rosters', label: 'Rosters', prefix: '/teams' },
  { kind: 'menu', id: 'managers', label: 'Managers', prefix: '/managers' },
  { kind: 'menu', id: 'players', label: 'Players', prefix: '/players' },
  { kind: 'link', to: '/h2h', label: 'Head to Head' },
  { kind: 'link', to: '/records', label: 'Records' },
  { kind: 'link', to: '/stats', label: 'Stats' },
  { kind: 'link', to: '/history', label: 'History' },
  { kind: 'link', to: '/draft', label: 'Draft' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `relative flex h-12 shrink-0 items-center whitespace-nowrap px-2.5 transition-colors after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full ${isActive ? 'text-ink after:bg-accent' : 'text-muted after:bg-transparent hover:text-ink'}`;

const managers = managerEntries(history);

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [rosters, setRosters] = useState<MenuEntries>('loading');
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  // team names live in the season file, so the Rosters list arrives once it has loaded
  useEffect(() => {
    let live = true;
    loadSeason(currentSeason.year).then((s) => { if (live) setRosters(rosterEntries(s)); }).catch(() => { if (live) setRosters('failed'); });
    return () => { live = false; };
  }, []);
  const entriesOf = (id: MenuId): MenuEntries => (id === 'rosters' ? rosters : id === 'players' ? playerEntries : managers);
  const activeOf = (prefix: string) => pathname === prefix || pathname.startsWith(`${prefix}/`);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-12 w-full max-w-[1400px] items-center gap-3 px-4 sm:gap-6 sm:px-6 lg:px-10">
        <NavLink to="/" className="shrink-0 whitespace-nowrap font-semibold tracking-tight" onClick={() => setOpen(false)}>{leagueConfig.name}</NavLink>
        <nav className="hidden h-full min-w-0 items-center gap-1 text-sm md:flex">
          {items.map((i) => i.kind === 'link'
            ? <NavLink key={i.to} to={i.to} className={linkClass}>{i.label}</NavLink>
            : (
              <NavMenu
                key={i.id} id={i.id} label={i.label} active={activeOf(i.prefix)} entries={entriesOf(i.id)}
                pinned={pinnedId === i.id}
                onPin={(p) => setPinnedId((cur) => (p ? i.id : cur === i.id ? null : cur))}
                onEnter={() => setPinnedId((cur) => (cur === i.id ? cur : null))}
              />
            ))}
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
            {items.map((i) => i.kind === 'link' ? (
              <NavLink
                key={i.to}
                to={i.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `rounded px-3 py-2 ${isActive ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'}`}
              >
                {i.label}
              </NavLink>
            ) : (
              <NavMenuGroup key={i.id} label={i.label} active={activeOf(i.prefix)} entries={entriesOf(i.id)} onNavigate={() => setOpen(false)} />
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
