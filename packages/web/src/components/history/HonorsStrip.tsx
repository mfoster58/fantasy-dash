import type { Honors, Manager, SeasonStatus, UserId } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import { ManagerLink, TeamLink } from '../NameLink';

interface Props { honors: Honors; managers: Record<UserId, Manager>; status: SeasonStatus; lastScoredWeek: number; year: number }

const tiles: { key: keyof Honors; label: string }[] = [
  { key: 'champion', label: 'Champion' }, { key: 'runnerUp', label: 'Runner-up' }, { key: 'third', label: 'Third' },
  { key: 'pointsTitle', label: 'Points title' }, { key: 'lastPlace', label: 'Last place' },
];

export default function HonorsStrip({ honors, managers, status, lastScoredWeek, year }: Props) {
  if (status === 'in_season') return <div className="card p-4 text-sm text-muted">Season in progress · through week {lastScoredWeek}. Honors are decided after the playoffs.</div>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map((t) => {
        const id = honors[t.key];
        const m = id ? managers[id] : undefined;
        return (
          <div key={t.key} className="card flex items-center gap-3 p-3">
            <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={36} />
            <div className="min-w-0">
              <div className="section-label">{t.label}</div>
              {id ? <TeamLink userId={id} year={year} className="block truncate font-semibold">{m?.teamName ?? m?.displayName ?? id}</TeamLink> : <div className="text-muted">—</div>}
              {id && m?.teamName && <ManagerLink userId={id} className="block truncate text-xs text-muted">{m.displayName}</ManagerLink>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
