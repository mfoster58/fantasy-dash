import { NavLink } from 'react-router';

/** The Teams / Managers sub-tab row shared by every page under the Teams nav item. */
export default function TeamsTabs({ teamsTo }: { teamsTo: string }) {
  const cls = ({ isActive }: { isActive: boolean }) => `-mb-px border-b-2 px-3 py-2 text-sm ${isActive ? 'border-ink font-medium text-ink' : 'border-transparent text-muted hover:text-ink'}`;
  return (
    <nav className="flex border-b border-line" aria-label="Teams sections">
      <NavLink to={teamsTo} className={cls}>Teams</NavLink>
      <NavLink to="/managers" className={cls}>Managers</NavLink>
    </nav>
  );
}
