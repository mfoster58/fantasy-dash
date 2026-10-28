import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { NavMenuGroup, type MenuEntries } from './NavMenu';

/** the four pages a phone reaches in one tap; everything else sits in the More sheet */
const TABS = [
  { to: '/', label: 'Home', icon: 'home', on: (p: string) => p === '/' },
  { to: '/scores', label: 'Scores', icon: 'scores', on: (p: string) => p === '/scores' || p.startsWith('/scores/') },
  { to: '/standings', label: 'Standings', icon: 'standings', on: (p: string) => p === '/standings' || p.startsWith('/standings/') },
  { to: '/players', label: 'Players', icon: 'players', on: (p: string) => p.startsWith('/player/') || ((p === '/players' || p.startsWith('/players/')) && !p.startsWith('/players/compare')) },
] as const;

const SHEET_LINKS = [
  { to: '/players/compare', label: 'Comparison tool' },
  { to: '/h2h', label: 'Head to Head' },
  { to: '/records', label: 'Records' },
  { to: '/stats', label: 'Stats' },
  { to: '/history', label: 'History' },
  { to: '/draft', label: 'Draft' },
];

/** 22px line icons drawn in the current colour */
function Icon({ name }: { name: (typeof TABS)[number]['icon'] | 'more' }) {
  const paths: Record<string, ReactNode> = {
    home: <><path d="M4 11.5 12 5l8 6.5" /><path d="M6.5 10v9h11v-9" /><path d="M10 19v-5h4v5" /></>,
    scores: <><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="M12 5.5v13" /><path d="M7 10.5v3M17 10.5v3" /></>,
    standings: <><path d="M5 7h3M5 12h3M5 17h3" /><path d="M11 7h8M11 12h6M11 17h4" /></>,
    players: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
    more: <><circle cx="6" cy="12" r="1.4" fill="currentColor" /><circle cx="12" cy="12" r="1.4" fill="currentColor" /><circle cx="18" cy="12" r="1.4" fill="currentColor" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const tab = (on: boolean) =>
  `relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors before:absolute before:inset-x-5 before:top-0 before:h-0.5 before:rounded-full ${on ? 'text-accent before:bg-accent' : 'text-muted before:bg-transparent'}`;

/**
 * A phone's app-style tab bar, fixed to the bottom of the screen: Home, Scores, Standings, Players, and More,
 * which slides a sheet up over a dimmed page with the other pages and the Rosters and Managers lists.
 */
export default function BottomNav({ rosters, managers }: { rosters: MenuEntries; managers: MenuEntries }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const onTab = TABS.some((t) => t.on(pathname));
  const moreOn = open || !onTab;
  const close = () => setOpen(false);
  return (
    <>
      {open && (
        <>
          <div data-testid="nav-backdrop" aria-hidden="true" onClick={close} className="fixed inset-0 z-40 bg-black/55 md:hidden" />
          <div
            id="nav-menu" data-testid="nav-menu"
            className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 max-h-[75dvh] animate-[sheet-up_200ms_ease-out] overflow-y-auto rounded-t-2xl border-t border-line bg-surface px-3 pb-3 pt-2 shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.5)] md:hidden"
          >
            <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <nav aria-label="More pages" className="grid grid-cols-2 gap-2">
              {SHEET_LINKS.map((l) => (
                <NavLink
                  key={l.to} to={l.to} onClick={close}
                  className={({ isActive }) => `flex min-h-12 items-center rounded-xl px-3.5 text-[15px] font-medium ${isActive ? 'bg-accent/15 text-accent' : 'bg-surface-2/70 text-ink'}`}
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 border-t border-line pt-2 text-base">
              <NavMenuGroup label="Rosters" active={pathname.startsWith('/teams/')} entries={rosters} onNavigate={close} />
              <NavMenuGroup label="Managers" active={pathname.startsWith('/managers/')} entries={managers} onNavigate={close} />
            </div>
          </div>
        </>
      )}
      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {TABS.map((t) => {
            const on = !open && t.on(pathname);
            return (
              <Link key={t.to} to={t.to} aria-current={on ? 'page' : undefined} className={tab(on)}>
                <Icon name={t.icon} />{t.label}
              </Link>
            );
          })}
          <button type="button" aria-expanded={open} aria-controls="nav-menu" data-active={moreOn ? 'true' : undefined} onClick={() => setOpen((o) => !o)} className={tab(moreOn)}>
            <Icon name="more" />More
          </button>
        </div>
      </nav>
    </>
  );
}
