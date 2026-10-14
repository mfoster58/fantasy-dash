import type { GameSide, Manager, UserId } from '@fantasy-dash/core';
import { fmtPts, fmtSigned } from '../../lib/format';

interface Props { sides: [GameSide, GameSide]; managers: Record<UserId, Manager> }

function Row({ label, value, detail }: { label: string; value: number; detail: string }) {
  const tone = value > 0 ? 'text-win' : value < 0 ? 'text-loss' : 'text-muted';
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted">{label} <span className="num text-xs">({detail})</span></span>
      <span className={`num ${tone}`}>{fmtSigned(value)}</span>
    </div>
  );
}

export default function FormBlock({ sides, managers }: Props) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <h2 className="mb-3 text-xs uppercase tracking-wide text-muted" title="Points scored relative to projection and to season average">Form</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {sides.map((s) => {
          const missing = s.starters.filter((e) => e.player && e.player.projected === null).length;
          return (
            <div key={s.userId} className="space-y-2 text-sm">
              <div className="font-medium">{managers[s.userId]?.displayName ?? s.userId}</div>
              <Row label="vs projection" value={s.points - s.projected} detail={`projected ${fmtPts(s.projected)}`} />
              <Row label="vs season PPG" value={s.points - s.seasonPpg} detail={`averaging ${fmtPts(s.seasonPpg)}`} />
              {missing > 0 && (
                <p className="text-xs text-muted">{missing} starter{missing > 1 ? 's' : ''} had no projection.</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
