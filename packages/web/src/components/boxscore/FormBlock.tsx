import type { GameSide, Manager, UserId } from '@fantasy-dash/core';
import { ManagerLink } from '../NameLink';
import { fmtPts, fmtSigned } from '../../lib/format';

interface Props { sides: [GameSide, GameSide]; managers: Record<UserId, Manager> }

/** A delta of this many points fills half the bar. */
const FULL_SCALE = 40;

function Bar({ delta }: { delta: number }) {
  const half = (Math.min(Math.abs(delta), FULL_SCALE) / FULL_SCALE) * 50;
  const color = delta >= 0 ? 'var(--win)' : 'var(--loss)';
  return (
    <div className="relative h-2 rounded-full bg-surface-2" aria-hidden="true">
      <div
        className={`absolute inset-y-0 ${delta >= 0 ? 'rounded-r-full' : 'rounded-l-full'}`}
        style={{
          [delta >= 0 ? 'left' : 'right']: '50%',
          width: `${half}%`,
          background: `color-mix(in srgb, ${color} 65%, transparent)`,
        }}
      />
      <div className="absolute -inset-y-1 left-1/2 w-px -translate-x-1/2 bg-muted" />
    </div>
  );
}

function Row({ label, points, baseline }: { label: string; points: number; baseline: number }) {
  const delta = points - baseline;
  const tone = delta > 0 ? 'text-win' : delta < 0 ? 'text-loss' : 'text-muted';
  const pct = baseline > 0 ? `${Math.round((points / baseline) * 100)}%` : '–';
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)_3.25rem_2.75rem] items-center gap-x-3 max-sm:grid-cols-[6.5rem_minmax(0,1fr)_3.25rem_2.75rem]">
      <span className="whitespace-nowrap text-muted max-sm:text-xs">{label}</span>
      <Bar delta={delta} />
      <span className={`num text-right ${tone}`}>{fmtSigned(delta)}</span>
      <span className="num text-right text-xs text-muted">{pct}</span>
    </div>
  );
}

export default function FormBlock({ sides, managers }: Props) {
  return (
    <section className="card flex flex-col p-5">
      <h2 className="section-label mb-3" title="Points scored relative to projection and to season average">Form</h2>
      <div className="space-y-5">
        {sides.map((s) => {
          const missing = s.starters.filter((e) => e.player && e.player.projected === null).length;
          return (
            <div key={s.userId} className="space-y-2 text-sm">
              <div><ManagerLink userId={s.userId} className="font-medium">{managers[s.userId]?.displayName ?? s.userId}</ManagerLink></div>
              <Row label="vs projection" points={s.points} baseline={s.projected} />
              <Row label="vs season average" points={s.points} baseline={s.seasonPpg} />
              <p className="num text-xs text-muted">
                {fmtPts(s.points)} scored · {fmtPts(s.projected)} projected · {fmtPts(s.seasonPpg)} average
              </p>
              {missing > 0 && (
                <p className="text-xs text-muted">{missing} starter{missing > 1 ? 's' : ''} had no projection.</p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-auto pt-4 text-xs text-muted">Midpoint of each bar is the team&rsquo;s projection or season average.</p>
    </section>
  );
}
