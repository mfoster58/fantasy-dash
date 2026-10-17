import { Link } from 'react-router';
import type { UserId } from '@fantasy-dash/core';
import type { ManagerRef } from '../../lib/stats/scope';
import type { Moment, Moments as MomentsData } from '../../lib/stats/moments';
import { fmtPts, fmtSigned } from '../../lib/format';
import Avatar from '../Avatar';
import { Empty } from './StatCard';
import { usePinHover, type Pin } from './pin';

/** each list, and which side of the game it is about */
const LISTS: { key: keyof MomentsData; title: string; featured: 'win' | 'loss' }[] = [
  { key: 'robbed', title: 'High score in a loss', featured: 'loss' },
  { key: 'stolen', title: 'Low score in a win', featured: 'win' },
  { key: 'flattened', title: 'Blowouts', featured: 'win' },
  { key: 'close', title: 'Close calls', featured: 'win' },
];

interface BarProps { side: 'win' | 'loss'; id: UserId; points: number; max: number; featured: boolean; active: Pin; refs: ManagerRef[] }

/** one side of a game: who, a bar as long as the score on the list's shared scale, the score */
function Bar({ side, id, points, max, featured, active, refs }: BarProps) {
  const ref = refs.find((r) => r.id === id);
  const fill = id === active ? 'var(--gold)' : `color-mix(in srgb, var(--${side === 'win' ? 'win' : 'loss'}) ${featured ? 70 : 40}%, var(--surface-2))`;
  return (
    <div data-bar={side} data-featured={featured ? 'true' : undefined} className="grid grid-cols-[6.5rem_minmax(0,1fr)_3.25rem] items-center gap-2">
      <span className={`flex min-w-0 items-center gap-1.5 text-xs ${featured ? 'font-semibold text-ink' : 'text-muted'} ${id === active ? 'text-gold' : ''}`}>
        <Avatar avatar={ref?.avatar ?? null} name={ref?.name ?? id} size={16} />
        <span className="truncate">{ref?.name ?? id}</span>
      </span>
      <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <span data-fill className="block h-full rounded-full" style={{ width: `${max ? (points / max) * 100 : 0}%`, background: fill }} />
      </span>
      <span className={`num text-right text-xs ${featured ? 'font-semibold text-ink' : 'text-muted'}`}>{fmtPts(points)}</span>
    </div>
  );
}

/** Notable matchups: four short lists, each game drawn as the winner's bar over the loser's on one scale, so the gap is the margin. */
export default function Moments({ data, refs, pin, columns = 2 }: { data: MomentsData; refs: ManagerRef[]; pin: Pin; /** two lists across from sm, or one stacked column */ columns?: 1 | 2 }) {
  const { active, hoverProps } = usePinHover(pin);
  if (data.robbed.length === 0) return <Empty />;
  return (
    <div data-testid="moment-lists" className={`grid gap-5 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
      {LISTS.map((l) => {
        const games: Moment[] = data[l.key];
        const max = Math.max(...games.map((m) => m.winPts));
        return (
          <div key={l.key}>
            <h4 className="section-label mb-1.5">{l.title}</h4>
            <ol className="space-y-1" aria-label={l.title}>
              {games.map((m) => {
                const featuredId = l.featured === 'win' ? m.winnerId : m.loserId;
                const involved = active === null || active === m.winnerId || active === m.loserId;
                return (
                  <li key={`${m.year}-${m.week}-${m.matchupId}`} {...hoverProps(featuredId)} className={involved ? '' : 'opacity-40'}>
                    <Link to={`/scores/${m.year}/${m.week}/${m.matchupId}`} className="block rounded-md px-2 py-1.5 hover:bg-surface-2">
                      <div className="mb-1 flex items-baseline justify-between text-[10px] text-muted">
                        <span>Week {m.week}{m.year ? ` · ${m.year}` : ''}</span>
                        <span className="num font-semibold text-gold">{fmtSigned(m.margin, 2)}</span>
                      </div>
                      <div className="space-y-1">
                        <Bar side="win" id={m.winnerId} points={m.winPts} max={max} featured={l.featured === 'win'} active={active} refs={refs} />
                        <Bar side="loss" id={m.loserId} points={m.losePts} max={max} featured={l.featured === 'loss'} active={active} refs={refs} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
