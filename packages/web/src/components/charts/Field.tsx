import { useState, type ReactNode } from 'react';
import SeasonPicker from '../SeasonPicker';

/** Hover (and tap on touch) highlights one item; the rest dim. */
export function useHot(): [string | null, (key: string) => { onMouseEnter: () => void; onMouseLeave: () => void; onClick: () => void }] {
  const [hot, setHot] = useState<string | null>(null);
  return [hot, (key) => ({ onMouseEnter: () => setHot(key), onMouseLeave: () => setHot(null), onClick: () => setHot((h) => (h === key ? null : key)) })];
}

export function Seg<T extends string>({ label, options, value, onChange }: { label: string; options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-0.5 rounded-md bg-surface-2 p-0.5">
      {options.map(([v, text]) => (
        <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}
          className={`rounded px-2.5 py-0.5 text-xs ${v === value ? 'bg-line text-ink' : 'text-muted hover:text-ink'}`}>{text}</button>
      ))}
    </div>
  );
}

export function ChartCard({ id, title, years, year, onYear, controls, tip, legend, children }: {
  id: string; title: string; years: number[]; year: number; onYear: (y: number) => void; controls: ReactNode; tip: ReactNode; legend: ReactNode; children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="card @container overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 pb-2 pt-3">
        <div className="flex items-center gap-3">
          <h2 id={id} className="text-sm font-semibold uppercase tracking-wide">{title}</h2>
          <SeasonPicker years={years} value={year} onChange={(v) => { if (v !== 'all') onYear(v); }} />
        </div>
        <div className="flex flex-wrap items-center gap-2">{controls}</div>
      </div>
      {children}
      <div className="min-h-[2.5rem] border-t border-line px-4 py-2 text-xs" data-testid="chart-tip">{tip}</div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-[11px] text-muted">{legend}</div>
    </section>
  );
}

export const TipLine = ({ children }: { children: ReactNode }) => <span>{children}</span>;

/** The grey sideline bands either side of the field, with yard marks. */
export function Sidelines({ width, top, bottom, band, marks }: { width: number; top: number; bottom: number; band: number; marks: { y: number; label: string }[] }) {
  return (
    <g>
      {[0, width - band].map((x) => <rect key={x} x={x} y={top} width={band} height={bottom - top} rx={3} style={{ fill: 'var(--field-band)' }} />)}
      {marks.flatMap((m) => [band / 2, width - band / 2].map((x) => (
        <text key={`${m.label}-${x}`} x={x} y={m.y + 4} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: 'var(--muted)' }}>{m.label}</text>
      )))}
    </g>
  );
}

/** A rounded label chip. Width is estimated from the text so labels can be laid out before render. */
export function Chip({ x, y, text, fill, ink, anchor = 'start' }: { x: number; y: number; text: string; fill: string; ink: string; anchor?: 'start' | 'middle' | 'end' }) {
  const width = text.length * 7 + 10;
  const x0 = anchor === 'start' ? x : anchor === 'middle' ? x - width / 2 : x - width;
  return {
    width,
    el: (
      <g data-chip={text}>
        <rect x={x0} y={y - 11} width={width} height={15} rx={4} style={{ fill }} />
        <text x={x0 + width / 2} y={y} textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: ink }}>{text}</text>
      </g>
    ),
  };
}

/** A filled arrowhead at `to`, pointing away from `from`. */
export function Arrowhead({ from, to, fill, size = 9 }: { from: [number, number]; to: [number, number]; fill: string; size?: number }) {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const pt = (ang: number, r: number) => `${to[0] + Math.cos(ang) * r},${to[1] + Math.sin(ang) * r}`;
  return <polygon points={`${pt(a, size * 0.6)} ${pt(a + 2.4, size)} ${pt(a - 2.4, size)}`} style={{ fill }} />;
}

/** » and « either side of a number, at fixed distances from the centre. */
export function Chevrons({ cx, y, gap, fill }: { cx: number; y: number; gap: number; fill: string }) {
  const one = (x: number, dir: 1 | -1) => [0, 6].map((o) => (
    <path key={o} d={`M${x + o * dir} ${y - 9} L${x + o * dir + 7 * dir} ${y} L${x + o * dir} ${y + 9}`} fill="none" strokeWidth={3.2} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: fill }} />
  ));
  return <g>{one(cx - gap, 1)}{one(cx + gap, -1)}</g>;
}
