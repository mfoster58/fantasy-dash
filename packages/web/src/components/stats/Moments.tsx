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

/** one side of the scoreline: avatar and name on the outside, the score facing the middle */
function Side({ side, id, points, featured, active, refs }: { side: 'win' | 'loss'; id: UserId; points: number; featured: boolean; active: Pin; refs: ManagerRef[] }) {
  const ref = refs.find((r) => r.id === id);
  const tone = id === active ? 'text-gold' : side === 'win' ? 'text-win' : 'text-loss';
  return (
    <div data-side={side} data-featured={featured ? 'true' : undefined} className={`flex min-w-0 items-center gap-2 ${side === 'loss' ? 'flex-row-reverse text-right' : ''}`}>
      <Avatar avatar={ref?.avatar ?? null} name={ref?.name ?? id} size={20} />
      <span className={`min-w-0 flex-1 truncate text-xs ${featured ? 'font-semibold text-ink' : 'text-muted'}`}>{ref?.name ?? id}</span>
      <span className={`num text-sm ${featured ? 'font-bold' : 'font-medium'} ${tone}`}>{fmtPts(points)}</span>
    </div>
  );
}

/** Notable matchups: four short lists of scorelines, winner left and loser right, the margin between, and a bar split at each side's share of the points. */
export default function Moments({ data, refs, pin, columns = 2 }: { data: MomentsData; refs: ManagerRef[]; pin: Pin; /** two lists across from sm, or one stacked column */ columns?: 1 | 2 }) {
  const { active, hoverProps } = usePinHover(pin);
  if (data.robbed.length === 0) return <Empty />;
  return (
    <div data-testid="moment-lists" className={`grid gap-5 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
      {LISTS.map((l) => (
        <div key={l.key}>
          <h4 className="section-label mb-1.5">{l.title}</h4>
          <ol className="space-y-1" aria-label={l.title}>
            {data[l.key].map((m: Moment) => {
              const featuredId = l.featured === 'win' ? m.winnerId : m.loserId;
              const involved = active === null || active === m.winnerId || active === m.loserId;
              const share = m.winPts + m.losePts ? (m.winPts / (m.winPts + m.losePts)) * 100 : 50;
              return (
                <li key={`${m.year}-${m.week}-${m.matchupId}`} {...hoverProps(featuredId)} className={involved ? '' : 'opacity-40'}>
                  <Link to={`/scores/${m.year}/${m.week}/${m.matchupId}`} className="block rounded-md px-2 py-1.5 hover:bg-surface-2">
                    <div className="mb-1 text-[10px] text-muted">Week {m.week} · {m.year}</div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                      <Side side="win" id={m.winnerId} points={m.winPts} featured={l.featured === 'win'} active={active} refs={refs} />
                      <span data-margin className="num rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-gold">{fmtSigned(m.margin, 2)}</span>
                      <Side side="loss" id={m.loserId} points={m.losePts} featured={l.featured === 'loss'} active={active} refs={refs} />
                    </div>
                    <div className="relative mt-1.5 flex h-1.5 overflow-hidden rounded-full" title={`${fmtPts(m.winPts)} to ${fmtPts(m.losePts)}`}>
                      <span data-share="win" className="h-full" style={{ width: `${share}%`, background: 'color-mix(in srgb, var(--win) 70%, var(--surface-2))' }} />
                      <span data-share="loss" className="h-full flex-1" style={{ background: 'color-mix(in srgb, var(--loss) 70%, var(--surface-2))' }} />
                      <span aria-hidden="true" className="absolute left-1/2 top-0 h-full w-px bg-bg" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
