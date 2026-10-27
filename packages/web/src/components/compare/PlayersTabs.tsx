import { Link } from 'react-router';

/** Database | Compare, at the top of both Players pages. */
export default function PlayersTabs({ active, season }: { active: 'database' | 'compare'; season: number }) {
  const cls = (on: boolean) => `rounded px-3 py-1 text-sm ${on ? 'bg-line text-ink' : 'text-muted hover:text-ink'}`;
  return (
    <nav aria-label="Players" className="inline-flex gap-1 rounded-md bg-surface-2 p-1">
      <Link to={`/players/${season}`} className={cls(active === 'database')} aria-current={active === 'database' ? 'page' : undefined}>Database</Link>
      <Link to="/players/compare" className={cls(active === 'compare')} aria-current={active === 'compare' ? 'page' : undefined}>Compare</Link>
    </nav>
  );
}
