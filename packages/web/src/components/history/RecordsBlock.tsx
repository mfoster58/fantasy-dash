import { Link } from 'react-router';
import type { Manager, UserId } from '@fantasy-dash/core';
import type { SeasonRecord } from '../../lib/records';
import Avatar from '../Avatar';

export default function RecordsBlock({ records, managers }: { records: SeasonRecord[]; managers: Record<UserId, Manager> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {records.map((r) => {
        const m = managers[r.userId];
        return (
          <div key={r.key} className="card p-3" title={r.definition}>
            <div className="section-label">{r.label}</div>
            <div className="num mt-1 text-xl font-semibold">{r.value}</div>
            <Link to={`/h2h?a=${r.userId}`} className="mt-1 flex items-center gap-2 text-sm hover:text-accent">
              <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={20} />
              <span className="truncate">{m?.displayName ?? r.userId}</span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
