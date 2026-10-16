import type { ReactNode } from 'react';
import { Link } from 'react-router';
import Avatar from '../Avatar';
import type { SparkPoint } from '../../lib/indexRows';
import { fmtPpg } from '../../lib/format';

const DOT: Record<'W' | 'L' | 'T', string> = { W: 'var(--win)', L: 'var(--loss)', T: 'var(--muted)' };

/** A hand-sized line of the row's points against the league average; dots coloured by result when there is one. */
export function Spark({ points, label }: { points: SparkPoint[]; label: string }) {
  const W = 180, H = 44, P = 5;
  if (points.length === 0) return <div className="flex h-11 w-[180px] items-center justify-center text-[10px] text-muted">no games yet</div>;
  const vals = points.flatMap((p) => [p.value, p.league]);
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const x = (i: number) => (points.length > 1 ? P + (i * (W - 2 * P)) / (points.length - 1) : W / 2);
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const d = (pick: (p: SparkPoint) => number) => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} className="shrink-0">
      <path d={d((p) => p.league)} fill="none" stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
      <path d={d((p) => p.value)} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      {points.map((p, i) => (
        <circle key={p.label} cx={x(i)} cy={y(p.value)} r={p.result ? 3 : 2.5} fill={p.result ? DOT[p.result] : 'var(--accent)'} stroke="var(--surface)" strokeWidth="1" data-result={p.result}>
          <title>{p.label}: {fmtPpg(p.value)} (league {fmtPpg(p.league)}){p.result ? ` · ${p.result}` : ''}</title>
        </circle>
      ))}
    </svg>
  );
}

export interface RowStat { label: string; value: ReactNode; sub?: ReactNode; tone?: 'win' | 'loss' | 'gold' | null }
const TONE = { win: 'text-win', loss: 'text-loss', gold: 'text-gold' } as const;

interface Props {
  to: string; rank: number; avatar: string | null; name: string;
  title: ReactNode; subtitle: ReactNode;
  /** under the subtitle: finish, chips, form */
  badge?: ReactNode;
  stats: RowStat[];
  /** right of the stats */
  visual?: ReactNode;
  cta: string;
}

/** One full-width row on an index page, the whole thing a link: rank, avatar, names, a stat strip, a visual and a call to action. */
export default function IndexRow({ to, rank, avatar, name, title, subtitle, badge, stats, visual, cta }: Props) {
  return (
    <li>
      <Link to={to} className="card group flex flex-col gap-4 p-4 transition-colors hover:border-accent hover:bg-surface-2 lg:flex-row lg:items-center lg:gap-6">
        <span className="flex min-w-0 items-center gap-4 lg:w-[22rem] lg:shrink-0">
          <span className="num w-8 shrink-0 text-center text-xl font-bold text-muted">{rank}</span>
          <Avatar avatar={avatar} name={name} size={56} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-semibold leading-tight group-hover:text-accent">{title}</span>
            <span className="block truncate text-sm text-muted">{subtitle}</span>
            {badge && <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">{badge}</span>}
          </span>
        </span>
        <dl className="grid flex-1 grid-cols-3 gap-x-4 gap-y-2 sm:grid-cols-6">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dt className="section-label truncate text-[10px]">{s.label}</dt>
              <dd className={`num truncate text-base font-semibold leading-tight ${s.tone ? TONE[s.tone] : ''}`}>{s.value}</dd>
              {s.sub && <dd className="num truncate text-[10px] text-muted">{s.sub}</dd>}
            </div>
          ))}
        </dl>
        <span className="flex items-center justify-between gap-4 lg:shrink-0">
          {visual}
          <span className="num whitespace-nowrap text-sm font-medium text-accent">{cta} →</span>
        </span>
      </Link>
    </li>
  );
}
