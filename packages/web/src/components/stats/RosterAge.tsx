import type { ManagerRef } from '../../lib/stats/scope';
import type { RosterAge as AgeData } from '../../lib/stats/roster';
import { Empty } from './StatCard';
import { markAttrs, usePinHover, type Pin } from './pin';
import { useWidth } from './useWidth';

const H = 180, PAD = 60, AXIS = 92;

/** a dot per manager on a spectrum from rookie-heavy to veteran-heavy rosters */
export default function RosterAge({ data, refs, pin }: { data: AgeData; refs: ManagerRef[]; pin: Pin }) {
  const { active, hoverProps } = usePinHover(pin);
  const [box, W] = useWidth<HTMLDivElement>();
  if (data.rows.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const ages = data.rows.map((r) => r.age);
  const lo = Math.min(...ages) - 0.5, hi = Math.max(...ages) + 0.5;
  const x = (v: number) => PAD + ((v - lo) / (hi - lo || 1)) * (W - 2 * PAD);
  return (
    <div ref={box}>
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Roster age">
      <defs><linearGradient id="roster-age-grad" x1="0" x2="1"><stop offset="0" stopColor="var(--win)" /><stop offset="0.5" stopColor="var(--gold)" /><stop offset="1" stopColor="var(--loss)" /></linearGradient></defs>
      <rect x={PAD} y={AXIS - 2} width={W - 2 * PAD} height="4" rx="2" fill="url(#roster-age-grad)" opacity="0.7" />
      <text x={PAD - 8} y={AXIS + 4} fontSize="13" fontWeight="700" fill="var(--win)" textAnchor="end">ROOK</text>
      <text x={W - PAD + 8} y={AXIS + 4} fontSize="13" fontWeight="700" fill="var(--loss)">UNC</text>
      {data.rows.map((r, i) => {
        const cx = x(r.age), up = i % 2 === 0, ty = up ? AXIS - 36 : AXIS + 44;
        const pinned = r.id === active, dim = active !== null && !pinned;
        return (
          <g key={r.id} {...hoverProps(r.id)} opacity={dim ? 0.4 : 1}>
            <line x1={cx} x2={cx} y1={up ? AXIS - 28 : AXIS + 8} y2={up ? AXIS - 8 : AXIS + 28} stroke={pinned ? 'var(--gold)' : 'var(--dim)'} />
            <circle data-manager={r.id} {...markAttrs(r.id, active)} cx={cx} cy={AXIS} r={pinned ? 6 : 4.5} fill={pinned ? 'var(--gold)' : 'var(--muted)'} stroke="var(--surface)" strokeWidth="1.5">
              <title>{`${name(r.id)}: average age ${r.age.toFixed(1)} · rookies ${Math.round(r.rookieShare * 100)}%, 30 and over ${Math.round(r.vetShare * 100)}%`}</title>
            </circle>
            <text x={cx} y={ty} fontSize="13" textAnchor="middle" fill={pinned ? 'var(--gold)' : 'var(--ink)'} fontWeight={pinned ? 600 : 400}>{name(r.id)}</text>
            <text x={cx} y={ty + (up ? -15 : 15)} fontSize="11" textAnchor="middle" fill="var(--muted)" className="num">{r.age.toFixed(1)}</text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}
