export interface BarRow { key: string; label: string; sub: string; width: number; fill: string; value: string; rank: string }

/** The secondary list beside a chart: one bar per item, linked to the chart by hover. */
export default function ChartBars({ rows, hot, bind }: { rows: BarRow[]; hot: string | null; bind: (k: string) => object }) {
  return (
    <ul className="flex flex-col justify-center gap-0.5 border-t border-line px-4 py-3 lg:border-l lg:border-t-0" aria-label="Bars">
      {rows.map((r) => (
        <li key={r.key} data-key={r.key} data-hot={hot === r.key} {...bind(r.key)}
          className={`grid cursor-pointer grid-cols-[6rem_minmax(0,1fr)_3.6rem_2.4rem] items-center gap-2.5 rounded px-1.5 py-1 text-xs ${hot === r.key ? 'bg-surface-2' : ''}`}>
          <span className="truncate">{r.label} <span className="text-muted">{r.sub}</span></span>
          <span className="relative h-1.5 rounded-full bg-surface-2"><span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(2, r.width)}%`, background: r.fill }} /></span>
          <span className="num text-right text-muted">{r.value}</span>
          <span className="num text-right font-semibold">{r.rank}</span>
        </li>
      ))}
    </ul>
  );
}
