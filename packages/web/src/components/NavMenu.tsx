import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import Avatar from './Avatar';
import type { MenuEntry } from '../lib/navMenus';

/** The list a menu shows: the entries, or why there are none yet. */
export type MenuEntries = MenuEntry[] | 'loading' | 'failed';

const Chevron = ({ open }: { open: boolean }) => (
  <svg aria-hidden="true" viewBox="0 0 10 6" width="10" height="6" className={`ml-1 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
    <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Entries({ entries, onPick, className }: { entries: MenuEntries; onPick?: () => void; className: string }) {
  if (entries === 'loading') return <p className="px-3 py-2 text-xs text-muted">Loading…</p>;
  if (entries === 'failed') return <p className="px-3 py-2 text-xs text-muted">Could not load this season's teams. Reload the page to try again.</p>;
  return (
    <ul className={className}>
      {entries.map((e) => (
        <li key={e.userId}>
          <Link to={e.to} onClick={onPick} className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 hover:bg-surface-2">
            <Avatar avatar={e.avatar} name={e.title} size={24} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm text-ink">{e.title}</span>
              {e.subtitle && <span className="block truncate text-xs text-muted">{e.subtitle}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

interface Props {
  id: string; label: string; active: boolean; entries: MenuEntries;
  /** pinned open by a click; owned by the bar so only one menu can be pinned at a time */
  pinned: boolean; onPin: (pinned: boolean) => void;
  /** the pointer arrived: the bar unpins any other menu */
  onEnter?: () => void;
}

/**
 * A top-bar tab that drops a panel of links instead of leading anywhere itself.
 * Hover opens it for as long as the pointer stays; a click pins it until the next click,
 * Escape, a press outside, or navigation.
 */
export default function NavMenu({ id, label, active, entries, pinned, onPin, onEnter }: Props) {
  const [hover, setHover] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const open = hover || pinned;
  const close = () => { setHover(false); onPin(false); };
  useEffect(() => { setHover(false); onPin(false); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onPress = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) close(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPress);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onPress); };
  }, [pinned]); // eslint-disable-line react-hooks/exhaustive-deps
  const panelId = `nav-menu-${id}`;
  return (
    <div ref={wrap} className="relative flex h-full items-center" onMouseEnter={() => { setHover(true); onEnter?.(); }} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        data-active={active ? 'true' : undefined}
        onClick={() => { onPin(!pinned); setHover(false); }}
        className={`relative flex h-12 shrink-0 items-center whitespace-nowrap px-2.5 transition-colors after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full ${active ? 'text-ink after:bg-accent' : 'text-muted after:bg-transparent hover:text-ink'}`}
      >
        {label}<Chevron open={open} />
      </button>
      {open && (
        <div id={panelId} className="absolute left-0 top-full z-20 w-64 rounded-lg border border-line bg-bg p-1 shadow-lg">
          <Entries entries={entries} className="max-h-[70vh] overflow-y-auto" />
        </div>
      )}
    </div>
  );
}

/** The same links as a collapsible group inside the narrow-screen sheet. */
export function NavMenuGroup({ label, active, entries, onNavigate }: { label: string; active: boolean; entries: MenuEntries; onNavigate: () => void }) {
  const [open, setOpen] = useState(active);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center rounded px-3 py-2 text-left ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}
      >
        {label}<Chevron open={open} />
      </button>
      {open && <Entries entries={entries} onPick={onNavigate} className="mb-1 ml-3 border-l border-line pl-1" />}
    </div>
  );
}
