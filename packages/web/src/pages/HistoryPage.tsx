import { Link } from 'react-router';
import type { UserId } from '@fantasy-dash/core';
import Avatar from '../components/Avatar';
import { history } from '../data/load';

function Who({ id }: { id: UserId | null }) {
  if (!id) return <span className="text-muted">—</span>;
  const m = history.managers[id];
  return (
    <Link to={`/h2h?a=${id}`} className="flex items-center gap-2 hover:text-accent">
      <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? id} size={24} />
      <span className="font-medium">{m?.displayName ?? id}</span>
    </Link>
  );
}

export default function HistoryPage() {
  const seasons = [...history.seasons].reverse();
  return (
    <section className="space-y-4">
      <header><h1 className="text-[22px] font-semibold">League History</h1></header>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              {['Season', 'Champion', 'Runner-up', 'Points title', 'Last place', ''].map((h) => (
                <th key={h} scope="col" className="section-label px-3 py-2 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seasons.map((s) => (
              <tr key={s.year} data-testid="history-row" className="border-t border-line transition-colors hover:bg-surface-2">
                <td className="num px-3 py-3 font-semibold">{s.year}</td>
                {s.status === 'in_season' ? (
                  <td colSpan={4} className="px-3 py-3 text-muted">In progress · through week {s.lastScoredWeek}</td>
                ) : (
                  <>
                    <td className="px-3 py-3"><Who id={s.honors.champion} /></td>
                    <td className="px-3 py-3"><Who id={s.honors.runnerUp} /></td>
                    <td className="px-3 py-3"><Who id={s.honors.pointsTitle} /></td>
                    <td className="px-3 py-3"><Who id={s.honors.lastPlace} /></td>
                  </>
                )}
                <td className="px-3 py-3 text-right whitespace-nowrap"><Link to={`/history/${s.year}`} className="text-accent hover:underline">Season review →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Win and loss streaks, and every other manager record, live under <Link to="/records?tab=managers" className="text-accent hover:underline">Records → Managers</Link>.</p>
    </section>
  );
}
