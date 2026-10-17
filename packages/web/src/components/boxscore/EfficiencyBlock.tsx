import type { GameSide, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import { ManagerLink } from '../NameLink';
import { fmtPct, fmtPts, fmtSigned } from '../../lib/format';
import { playerName } from '../../lib/players';

interface Props { sides: [GameSide, GameSide]; managers: Record<UserId, Manager>; players: PlayerDirectory }

export default function EfficiencyBlock({ sides, managers, players }: Props) {
  return (
    <section className="card p-5">
      <h2 className="section-label mb-3" title="Points scored divided by the best possible lineup from the full roster">
        Efficiency
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {sides.map((s) => (
          <div key={s.userId}>
            <div className="flex items-baseline justify-between">
              <ManagerLink userId={s.userId} className="font-medium">{managers[s.userId]?.displayName ?? s.userId}</ManagerLink>
              <span className="num text-lg">{fmtPct(s.efficiency)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-surface-2">
              <div
                className="h-full rounded"
                style={{ width: `${Math.min(100, s.efficiency * 100)}%`, background: 'color-mix(in srgb, var(--accent) 65%, transparent)' }}
              />
            </div>
            <div className="num mt-1 text-xs text-muted">{fmtPts(s.points)} of {fmtPts(s.ceiling)} ceiling</div>
            {s.optimalSwaps.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Optimal lineup.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {s.optimalSwaps.map((sw) => (
                  <li key={sw.in} data-testid="swap">
                    Start <span className="font-medium">{playerName(players, sw.in)}</span>{' '}
                    <span className="num text-win">{fmtSigned(sw.gain, 2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
