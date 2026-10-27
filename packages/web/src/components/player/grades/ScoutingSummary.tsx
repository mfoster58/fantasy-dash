import { ordinal, pctColor } from '../../../lib/charts/scale';
import type { SummaryRow } from '../../../lib/grades/grade';

function Column({ title, rows }: { title: string; rows: SummaryRow[] }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1.5 text-[13px] font-semibold">{title}</h3>
      {rows.length === 0 && <p className="text-xs text-muted">Nothing yet.</p>}
      <ul>
        {rows.map((r) => (
          <li key={`${r.card}-${r.label}`} data-testid="summary-row" className="flex items-baseline justify-between gap-3 border-b border-line py-1 text-[13px] last:border-0">
            <span className="min-w-0">{r.label} <span className="text-muted">· {r.card}</span></span>
            <b className="num shrink-0 font-semibold" style={{ color: pctColor(r.pct) }}>{r.text} · {ordinal(r.pct)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** His best and worst graded tiles, side by side (stacked on phones). */
export default function ScoutingSummary({ best, worst }: { best: SummaryRow[]; worst: SummaryRow[] }) {
  return (
    <div className="card grid gap-4 px-3.5 py-3 sm:grid-cols-2">
      <Column title="Best at" rows={best} />
      <Column title="Weakest at" rows={worst} />
    </div>
  );
}
