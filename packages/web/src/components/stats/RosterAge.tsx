import type { ManagerRef } from '../../lib/stats/scope';
import type { RosterAge as AgeData } from '../../lib/stats/roster';
import { Empty } from './StatCard';
import { markAttrs, usePinHover, type Pin } from './pin';
import { useWidth } from './useWidth';

const PAD = 60, LEVEL = 34, GAP = 8, NAME_PX = 7.5;

/**
 * Lane for each label, taken in order along the line: lane 0 is just above the line, 1 just below, 2 a level further
 * above, 3 further below, and so on. A label takes the nearest lane whose last label ends, plus a gap, before this one starts.
 */
export function labelLanes(xs: number[], widths: number[]): number[] {
  const ends: number[] = [];
  return xs.map((x, i) => {
    const left = x - widths[i] / 2;
    let k = 0;
    while (ends[k] !== undefined && ends[k] + GAP > left) k += 1;
    ends[k] = x + widths[i] / 2;
    return k;
  });
}

/** a dot per manager on a spectrum from rookie-heavy to veteran-heavy rosters; names stack outward only where they would collide */
export default function RosterAge({ data, refs, pin }: { data: AgeData; refs: ManagerRef[]; pin: Pin }) {
  const { active, hoverProps } = usePinHover(pin);
  const [box, W] = useWidth<HTMLDivElement>();
  if (data.rows.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const ages = data.rows.map((r) => r.age);
  const lo = Math.min(...ages) - 0.5, hi = Math.max(...ages) + 0.5;
  const x = (v: number) => PAD + ((v - lo) / (hi - lo || 1)) * (W - 2 * PAD);
  const xs = data.rows.map((r) => x(r.age));
  const lanes = labelLanes(xs, data.rows.map((r) => Math.max(name(r.id).length * NAME_PX, 36) + 4));
  const up = (k: number) => k % 2 === 0;
  const level = (k: number) => Math.floor(k / 2);
  const levelsUp = Math.max(0, ...lanes.filter(up).map(level)) + 1;
  const levelsDown = Math.max(-1, ...lanes.filter((k) => !up(k)).map(level)) + 1;
  const AXIS = 24 + levelsUp * LEVEL;
  const H = AXIS + levelsDown * LEVEL + 24;
  return (
    <div ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Roster age">
        <defs><linearGradient id="roster-age-grad" x1="0" x2="1"><stop offset="0" stopColor="var(--win)" /><stop offset="0.5" stopColor="var(--gold)" /><stop offset="1" stopColor="var(--loss)" /></linearGradient></defs>
        <rect x={PAD} y={AXIS - 2} width={W - 2 * PAD} height="4" rx="2" fill="url(#roster-age-grad)" opacity="0.7" />
        <text x={PAD - 8} y={AXIS + 4} fontSize="13" fontWeight="700" fill="var(--win)" textAnchor="end">ROOK</text>
        <text x={W - PAD + 8} y={AXIS + 4} fontSize="13" fontWeight="700" fill="var(--loss)">UNC</text>
        {data.rows.map((r, i) => {
          const cx = xs[i], k = lanes[i], isUp = up(k), lv = level(k);
          // the name sits in its lane; the age sits between the name and the line
          const nameY = isUp ? AXIS - 26 - lv * LEVEL : AXIS + 36 + lv * LEVEL;
          const ageY = isUp ? nameY + 13 : nameY - 15;
          const pinned = r.id === active, dim = active !== null && !pinned;
          return (
            <g key={r.id} {...hoverProps(r.id)} opacity={dim ? 0.4 : 1}>
              <line x1={cx} x2={cx} y1={isUp ? ageY + 4 : AXIS + 6} y2={isUp ? AXIS - 6 : ageY - 11} stroke={pinned ? 'var(--gold)' : 'var(--dim)'} />
              <circle data-manager={r.id} {...markAttrs(r.id, active)} cx={cx} cy={AXIS} r={pinned ? 6 : 4.5} fill={pinned ? 'var(--gold)' : 'var(--muted)'} stroke="var(--surface)" strokeWidth="1.5">
                <title>{`${name(r.id)}: average age ${r.age.toFixed(1)} · rookies ${Math.round(r.rookieShare * 100)}%, 30 and over ${Math.round(r.vetShare * 100)}%`}</title>
              </circle>
              <text x={cx} y={nameY} fontSize="13" textAnchor="middle" fill={pinned ? 'var(--gold)' : 'var(--ink)'} fontWeight={pinned ? 600 : 400}>{name(r.id)}</text>
              <text x={cx} y={ageY} fontSize="11" textAnchor="middle" fill="var(--muted)" className="num">{r.age.toFixed(1)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
