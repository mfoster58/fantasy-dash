import { Link } from 'react-router';
import { CardHeader } from '../draft/DraftAnalysis';
import type { ManagerRecord } from '../../lib/managerRecords';

interface Props { records: ManagerRecord[] }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Every record board where the manager sits in the top three, grouped by Records sub-tab; rank one in gold. */
export default function LeagueRecords({ records }: Props) {
  const firsts = records.filter((r) => r.rank === 1).length;
  const groups = new Map<string, { title: string; rows: ManagerRecord[] }>();
  for (const r of records) groups.set(r.sub, { title: r.subTitle, rows: [...(groups.get(r.sub)?.rows ?? []), r] });
  return (
    <section className="card">
      <CardHeader label="Record book" title="League records" aside={`${plural(firsts, 'league record')} · ${plural(records.length, 'top-three placing')}`} />
      {records.length === 0 ? <p className="px-4 py-3 text-xs text-muted">No top-three placings yet.</p> : (
        [...groups.entries()].map(([sub, g]) => (
          <div key={sub}>
            <h3 className="section-label border-b border-line bg-surface-2 px-4 py-1 text-[10px]">{g.title}</h3>
            <ul className="divide-y divide-line">
              {g.rows.map((r) => (
                <li key={r.boardId}>
                  <Link to={`/records?tab=managers&sub=${r.sub}`} data-rank={r.rank}
                    className={`flex items-center gap-3 px-4 py-1.5 text-sm hover:bg-surface-2 ${r.rank === 1 ? 'bg-[color-mix(in_srgb,var(--gold)_10%,transparent)]' : ''}`}>
                    <span className={`num w-5 text-center text-xs ${r.rank === 1 ? 'font-bold text-gold' : 'text-muted'}`}>{r.rank === 1 ? '♛' : r.rank}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate ${r.rank === 1 ? 'font-medium' : ''}`}>{r.title}</span>
                      <span className="block truncate text-xs text-muted">{r.meta}{r.detail ? ` · ${r.detail}` : ''}</span>
                    </span>
                    <span className={`num font-semibold ${r.rank === 1 ? 'text-gold' : ''}`}>{r.valueLabel}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
