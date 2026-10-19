import { NavLink } from 'react-router';

/** Managers | Players, at the top of both Stats pages. */
export default function StatsTabs() {
  const cls = ({ isActive }: { isActive: boolean }) => `rounded px-3 py-1 text-sm ${isActive ? 'bg-line text-ink' : 'text-muted hover:text-ink'}`;
  return (
    <nav aria-label="Stats" className="mb-4 inline-flex gap-1 rounded-md bg-surface-2 p-1">
      <NavLink to="/stats" end className={cls}>Managers</NavLink>
      <NavLink to="/stats/players" className={cls}>Players</NavLink>
    </nav>
  );
}
