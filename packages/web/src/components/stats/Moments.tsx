import { Link } from 'react-router';
import type { ManagerRef } from '../../lib/stats/scope';
import type { Moment, Moments as MomentsData } from '../../lib/stats/moments';
import { fmtPts, fmtSigned } from '../../lib/format';
import ManagerName from './ManagerName';
import { Empty } from './StatCard';
import { markAttrs, usePinHover, type Pin } from './pin';

const LISTS: { key: keyof MomentsData; title: string; who: (m: Moment) => string; value: (m: Moment) => string }[] = [
  { key: 'robbed', title: 'Robbed', who: (m) => m.loserId, value: (m) => fmtPts(m.losePts) },
  { key: 'stolen', title: 'Stolen', who: (m) => m.winnerId, value: (m) => fmtPts(m.winPts) },
  { key: 'flattened', title: 'Flattened', who: (m) => m.winnerId, value: (m) => fmtSigned(m.margin, 2) },
  { key: 'close', title: 'Close calls', who: (m) => m.winnerId, value: (m) => fmtPts(m.margin) },
];

export default function Moments({ data, refs, pin, columns = 2 }: { data: MomentsData; refs: ManagerRef[]; pin: Pin; /** two lists across from sm, or one stacked column */ columns?: 1 | 2 }) {
  const { active, hoverProps } = usePinHover(pin);
  if (data.robbed.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  return (
    <div data-testid="moment-lists" className={`grid gap-4 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
      {LISTS.map((l) => (
        <div key={l.key}>
          <h4 className="section-label mb-1">{l.title}</h4>
          <ol className="divide-y divide-line" aria-label={l.title}>
            {data[l.key].map((m) => { const who = l.who(m); const other = who === m.winnerId ? m.loserId : m.winnerId; return (
              <li key={`${m.year}-${m.week}-${m.matchupId}`} {...markAttrs(who, active)} {...hoverProps(who)} className={`grid grid-cols-[3.5rem_7rem_minmax(0,1fr)] items-center gap-2 py-1 text-xs ${active !== null && active !== who ? 'opacity-40' : ''}`}>
                <span className="num font-semibold text-gold">{l.value(m)}</span>
                <ManagerName id={who} refs={refs} active={active} avatar={false} />
                <Link to={`/scores/${m.year}/${m.week}/${m.matchupId}`} className="num truncate text-muted hover:text-accent">wk {m.week} · {fmtPts(m.winPts)}–{fmtPts(m.losePts)} vs {name(other)}</Link>
              </li>
            ); })}
          </ol>
        </div>
      ))}
    </div>
  );
}
