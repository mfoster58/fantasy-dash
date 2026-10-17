import type { Manager, UserId } from '@fantasy-dash/core';
import type { SeasonRecord } from '../../lib/records';
import Avatar from '../Avatar';
import { ManagerLink } from '../NameLink';

export default function RecordsBlock({ records, managers }: { records: SeasonRecord[]; managers: Record<UserId, Manager> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {records.map((r) => {
        const m = managers[r.userId];
        return (
          <div key={r.key} className="card p-3" title={r.definition}>
            <div className="section-label">{r.label}</div>
            <div className="num mt-1 text-xl font-semibold">{r.value}</div>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={20} />
              <ManagerLink userId={r.userId} className="truncate">{m?.displayName ?? r.userId}</ManagerLink>
            </div>
          </div>
        );
      })}
    </div>
  );
}
