import { winTone, type GameOutlook } from '../../lib/live/outlook';

/** The live win % split as a two-colour bar. */
export default function LiveOutlook({ outlook, names }: { outlook: GameOutlook; names: [string, string] }) {
  const { win } = outlook;
  return (
    <section className="card p-5" aria-label="Win probability">
      <h2 className="section-label mb-2">Win probability</h2>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {([0, 1] as const).map((i) => (
          <span key={i} data-testid={`win-${i}`} className="block h-full transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${win[i]}%`, background: winTone(win[i], win[1 - i]) }} />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-sm">
        <span><span className="num font-semibold">{win[0]}%</span> <span className="text-muted">{names[0]}</span></span>
        <span><span className="text-muted">{names[1]}</span> <span className="num font-semibold">{win[1]}%</span></span>
      </div>
    </section>
  );
}
