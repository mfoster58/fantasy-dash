import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPct, fmtPts } from '../../lib/format';
import type { LineupDesk } from '../../lib/teamProfile';

/** Career lineup efficiency: the share of the best possible points the manager actually started. */
export default function EfficiencyCard({ desk }: { desk: LineupDesk }) {
  return (
    <section className="card p-4">
      <CardHeader title="Efficiency" aside={`${desk.weeks} weeks`} />
      <div className="mt-3 flex items-center gap-4">
        <span className="num text-3xl font-semibold leading-none">{fmtPct(desk.efficiency)}</span>
        <div className="h-2 flex-1 overflow-hidden rounded bg-surface-2"><div className="h-full rounded bg-win" data-testid="efficiency-bar" style={{ width: fmtPct(Math.min(1, desk.efficiency), 0) }} /></div>
        <span className="num whitespace-nowrap text-xs text-muted"><span className="font-semibold text-ink">{fmtPts(desk.started)}</span> of {fmtPts(desk.possible)} max</span>
      </div>
    </section>
  );
}
