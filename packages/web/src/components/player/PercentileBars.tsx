import SeasonPicker from '../SeasonPicker';
import { COLUMNS, fmtValue } from '../../lib/playerdb/columns';
import type { Bar } from '../../lib/player/percentiles';

const tone = (p: number) => (p >= 66 ? 'var(--win)' : p >= 33 ? 'var(--warn)' : 'var(--loss)');

/** His percentile among the position's qualifiers for one season, one bar per metric. */
export default function PercentileBars({ pos, bars, years, year, onYear }: { pos: string; bars: Bar[]; years: number[]; year: number; onYear: (y: number) => void }) {
  return (
    <section aria-labelledby="pp-pct" className="card">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 pb-2 pt-3">
        <h2 id="pp-pct" className="text-sm font-semibold uppercase tracking-wide">Among {pos}s</h2>
        <SeasonPicker years={years} value={year} onChange={(v) => { if (v !== 'all') onYear(v); }} />
      </div>
      <ul className="space-y-2.5 px-4 py-3">
        {bars.map((b) => (
          <li key={b.key} data-testid="pct-bar" className="grid grid-cols-[6.5rem_minmax(0,1fr)_3.5rem_2.25rem] items-center gap-3 text-sm" title={COLUMNS[b.key].def}>
            <span className="truncate text-muted">{b.label}</span>
            <span className="relative h-2 rounded-full bg-surface-2">
              {b.pct !== null && <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.max(2, b.pct)}%`, background: tone(b.pct) }} />}
            </span>
            <span className="num text-right text-xs text-muted">{fmtValue(b.value, COLUMNS[b.key].fmt, b.mode)}</span>
            <span className="num text-right font-semibold">{b.small ? <span className="text-[10px] font-normal leading-none text-muted">small sample</span> : b.pct ?? '–'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
