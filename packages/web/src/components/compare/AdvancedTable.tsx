import { useMemo, useState } from 'react';
import { advancedRows, bucketsFor, type AdvancedRow } from '../../lib/compare/advanced';
import { ordinal, pctColor } from '../../lib/charts/scale';
import type { GradedCard, GradedTile } from '../../lib/grades/grade';
import { Seg } from '../charts/Field';

const short = (n: string) => { const [f, ...rest] = n.split(' '); return rest.length ? `${f[0]}. ${rest.join(' ')}` : n; };

/** A percentile fill behind the value, from the left edge to his percentile; grey for style tiles. */
function fill(t: GradedTile): string | undefined {
  if (t.status !== 'ranked' || t.pct === null) return undefined;
  const c = t.style ? 'var(--muted)' : pctColor(t.pct);
  return `linear-gradient(90deg, color-mix(in srgb, ${c} 30%, transparent) 0, color-mix(in srgb, ${c} 14%, transparent) ${t.pct}%, transparent ${t.pct}%)`;
}

function Cell({ t, lead }: { t: GradedTile | null; lead: boolean }) {
  if (!t) return <td className="border-b border-line px-2 py-1.5 text-right text-muted">—</td>;
  const tag = t.status === 'ranked' && t.pct !== null ? ordinal(t.pct) : t.status === 'small' ? 'n/r' : t.status === 'noFtn' ? 'no FTN data' : '';
  return (
    <td data-lead={lead} className={`border-b border-line px-2 py-1.5 text-right ${lead ? 'shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--gold)_60%,transparent)]' : ''}`} style={{ background: fill(t) }}>
      <span className="inline-flex items-baseline justify-end gap-1.5">
        <span className={`num ${lead ? 'font-bold text-gold' : ''}`}>{t.text}{lead && ' ▲'}</span>
        <span className="min-w-8 text-[10.5px] text-muted">{tag}</span>
      </span>
    </td>
  );
}

/** Every grade tile for the position, one column per player, the leader of each graded row in gold. */
export default function AdvancedTable({ names, cards }: { names: string[]; cards: (GradedCard[] | null)[] }) {
  const base = cards.find((c): c is GradedCard[] => c !== null) ?? [];
  const buckets = useMemo(() => bucketsFor(base), [base]);
  const [bucket, setBucket] = useState('All');
  const { rows, leads, contested } = useMemo(() => advancedRows(cards, bucket), [cards, bucket]);
  const byCard = rows.reduce<Map<string, AdvancedRow[]>>((m, r) => m.set(r.card, [...(m.get(r.card) ?? []), r]), new Map());

  return (
    <section aria-labelledby="cmp-adv" className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="cmp-adv" className="text-sm font-semibold uppercase tracking-wide">Advanced</h2>
        <Seg label="Buckets" options={buckets.map((b) => [b, b] as [string, string])} value={bucket} onChange={setBucket} />
      </div>
      {names.length > 1 && (
        <p data-testid="leads" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {names.map((n, i) => <span key={i}><span style={{ color: `var(--slot-${i})` }}>●</span> {short(n)} leads <b className="text-ink">{leads[i]}</b> of {contested}</span>)}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface px-2 py-1.5 text-left text-xs font-semibold text-muted">Stat</th>
              {names.map((n, i) => <th key={i} className="px-2 py-1.5 text-right text-xs font-semibold" style={{ color: `var(--slot-${i})` }}>{short(n)}</th>)}
            </tr>
          </thead>
          <tbody>
            {[...byCard].flatMap(([title, list]) => [
              <tr key={title}><td data-testid="adv-group" colSpan={names.length + 1} className="sticky left-0 bg-surface-2 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</td></tr>,
              ...list.map((r) => (
                <tr key={`${title}-${r.key}`} data-key={r.key}>
                  <td className="sticky left-0 z-10 border-b border-line bg-surface px-2 py-1.5 text-left">{r.label}{r.style && <span className="ml-1.5 text-[10.5px] text-muted">style</span>}</td>
                  {r.cells.map((t, i) => <Cell key={i} t={t} lead={r.lead[i]} />)}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </section>
  );
}
