import type { ManagerRef } from '../../lib/stats/scope';
import type { SosRow } from '../../lib/stats/strength';
import { fmtPpg, fmtPts } from '../../lib/format';
import ManagerName from './ManagerName';
import { Empty } from './StatCard';
import { markAttrs, usePinHover, type Pin } from './pin';

export default function StrengthOfSchedule({ rows, refs, pin }: { rows: SosRow[]; refs: ManagerRef[]; pin: Pin }) {
  const { active, hoverProps } = usePinHover(pin);
  if (rows.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const span = Math.max(1, ...rows.map((r) => Math.abs(r.delta)));
  const half = (d: number) => `${(Math.abs(d) / span) * 50}%`;
  return (
    <div>
      <ul className="space-y-1.5" aria-label="Strength of schedule">
        {rows.map((r) => (
          <li key={r.id} data-tone={r.delta > 0 ? 'loss' : 'win'} {...markAttrs(r.id, active)} {...hoverProps(r.id)} className={`grid grid-cols-[7rem_minmax(0,1fr)_3rem] items-center gap-2 ${active !== null && active !== r.id ? 'opacity-40' : ''}`}>
            <ManagerName id={r.id} refs={refs} active={active} />
            <span className="relative h-4">
              <span className="absolute left-1/2 top-0 h-full w-px bg-line" />
              <span title={`${name(r.id)}'s opponents scored ${fmtPts(r.faced)} a week against him, ${fmtPts(Math.abs(r.delta))} ${r.delta > 0 ? 'over' : 'under'} the league's ${fmtPts(r.leagueAvg)}`}
                className="absolute top-0.5 h-3 rounded-sm" style={{ left: r.delta > 0 ? '50%' : `calc(50% - ${half(r.delta)})`, width: half(r.delta), background: r.id === active ? 'var(--gold)' : r.delta > 0 ? 'var(--loss)' : 'var(--win)', opacity: 0.85 }} />
            </span>
            <span className="num text-right text-xs text-muted">{r.delta > 0 ? '+' : ''}{fmtPpg(r.delta)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-center text-[10px] text-muted">league average {fmtPpg(rows[0].leagueAvg)}</p>
    </div>
  );
}
