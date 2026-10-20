import { fmtPts } from '../../lib/format';
import type { GameOutlook } from '../../lib/live/outlook';

const COLORS = ['var(--accent)', 'var(--gold)'] as const;

/** Live projected finals (with the pre-game projection as a faint tick) and the two-colour win % bar. */
export default function LiveOutlook({ outlook, pregame, names }: { outlook: GameOutlook; pregame: [number, number]; names: [string, string] }) {
  const max = Math.max(1, ...outlook.projected, ...pregame);
  return (
    <section className="card grid gap-5 p-5 sm:grid-cols-2" aria-label="Live outlook">
      <div>
        <h2 className="section-label mb-2">Projected final</h2>
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate text-muted">{names[i]}</span>
              <span className="relative block h-2.5 rounded-full bg-surface-2">
                <span data-testid={`proj-bar-${i}`} className="block h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${(outlook.projected[i] / max) * 100}%`, background: COLORS[i] }} />
                <span data-testid={`pregame-${i}`} title={`Pre-game projection ${fmtPts(pregame[i])}`} className="absolute -top-1 h-4.5 w-0.5 bg-ink/40" style={{ left: `${(pregame[i] / max) * 100}%` }} />
              </span>
              <span className="num w-14 text-right font-semibold">{fmtPts(outlook.projected[i])}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h2 className="section-label mb-2">Win probability</h2>
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {[0, 1].map((i) => (
            <span key={i} data-testid={`win-${i}`} className="block h-full transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${outlook.win[i]}%`, background: COLORS[i] }} />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-sm">
          <span><span className="num font-semibold">{outlook.win[0]}%</span> <span className="text-muted">{names[0]}</span></span>
          <span><span className="text-muted">{names[1]}</span> <span className="num font-semibold">{outlook.win[1]}%</span></span>
        </div>
      </div>
    </section>
  );
}
