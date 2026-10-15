import { Link } from 'react-router';
import type { History } from '@fantasy-dash/core';
import type { Streak } from '../../lib/streaks';
import Avatar from '../Avatar';

interface Props { title: string; streaks: Streak[]; managers: History['managers'] }

const span = (s: Streak) => `${s.from.year} Wk ${s.from.week} to ${s.to.year} Wk ${s.to.week}`;

export default function StreaksCard({ title, streaks, managers }: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-line px-3 py-2"><h2 className="section-label">{title}</h2></div>
      {streaks.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted">No streaks yet.</p>
      ) : (
        <ol className="divide-y divide-line">
          {streaks.map((s, i) => {
            const m = managers[s.userId];
            const name = m?.displayName ?? s.userId;
            return (
              <li key={`${s.userId}-${s.from.year}-${s.from.week}`} className="flex items-center gap-3 px-3 py-2">
                <span className="num w-4 shrink-0 text-right text-xs text-muted">{i + 1}</span>
                <Link to={`/h2h?a=${s.userId}`} className="flex min-w-0 flex-1 items-center gap-2 hover:text-accent">
                  <Avatar avatar={m?.avatar ?? null} name={name} size={28} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{name}</span>
                    <span className="num block text-xs text-muted">
                      {span(s)}
                      {s.active && (
                        <span
                          className="ml-1.5 rounded-full px-1.5 text-[10px] font-semibold uppercase tracking-wide text-win"
                          style={{ background: 'color-mix(in srgb, var(--win) 15%, transparent)' }}
                        >
                          active
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
                <span className="num shrink-0 text-xl font-semibold">{s.length}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
