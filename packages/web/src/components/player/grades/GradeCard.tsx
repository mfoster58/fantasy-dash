import { ordinal, pctColor } from '../../../lib/charts/scale';
import type { GradedCard, GradedTile } from '../../../lib/grades/grade';

/** A style tile or an unranked one is grey; a graded tile takes its percentile's colour. */
export const tileColour = (t: GradedTile): string => (t.status !== 'ranked' || t.style || t.pct === null ? 'var(--dim)' : pctColor(t.pct));

function Tile({ t }: { t: GradedTile }) {
  const colour = tileColour(t);
  const ranked = t.status === 'ranked' && t.pct !== null;
  return (
    <div data-tile={t.key} data-pct={t.pct ?? ''} className="min-w-0 rounded-lg bg-surface-2 px-2.5 py-2" style={{ borderLeft: `4px solid ${colour}` }}>
      <div className="num text-lg font-semibold leading-tight">{t.text}</div>
      <div className="text-xs leading-snug">{t.label}</div>
      <div className="text-[11px] leading-snug text-muted">
        {ranked && <span style={{ color: t.style ? undefined : colour }}>{ordinal(t.pct!)} pct{t.style ? ' · style' : ''}</span>}
        {t.status === 'small' && <span>not ranked</span>}
        {(ranked || t.status === 'small') && t.detail && ' · '}
        {t.detail}
      </div>
      {ranked && (
        <div className="relative mt-1.5 h-1 rounded-full bg-line" aria-hidden>
          <span className="absolute -top-0.5 size-2 -translate-x-1/2 rounded-full" style={{ left: `${Math.max(2, t.pct!)}%`, background: t.style ? 'var(--muted)' : colour }} />
        </div>
      )}
    </div>
  );
}

/** One card of four graded tiles. */
export default function GradeCard({ card }: { card: GradedCard }) {
  return (
    <div data-testid="grade-card" className="card px-3.5 py-3">
      <h3 className="mb-2.5 text-[15px] font-semibold">{card.title}</h3>
      <div className="grid grid-cols-2 gap-1.5">{card.tiles.map((t) => <Tile key={t.key} t={t} />)}</div>
    </div>
  );
}
