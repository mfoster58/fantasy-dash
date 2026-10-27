import type { NextGame, PlayerSummary } from '../../lib/compare/summary';
import ScoreHistogram from './ScoreHistogram';

export interface CardLeads { floor: boolean; avg: boolean; ceil: boolean; cv: boolean }

const one = (v: number | null) => (v === null ? '—' : v.toFixed(1));
const TONE: Record<string, string> = { easy: 'var(--win)', hard: 'var(--loss)', mid: 'var(--dim)' };
const POS_NAME: Record<string, string> = { QB: 'QBs', RB: 'RBs', WR: 'WRs', TE: 'TEs' };

function Stat({ id, label, value, lead }: { id: string; label: string; value: number | null; lead: boolean }) {
  return (
    <div data-testid={`stat-${id}`} data-lead={lead} className={`rounded-lg border px-1 py-1.5 text-center ${lead ? 'border-gold bg-[linear-gradient(180deg,color-mix(in_srgb,var(--gold)_24%,var(--surface-2)),var(--surface-2))]' : 'border-transparent bg-[linear-gradient(180deg,var(--surface-2),color-mix(in_srgb,var(--surface-2)_70%,var(--bg)))]'}`}>
      <div className="num text-lg font-bold">{one(value)}{lead && <span className="ml-0.5 text-[10px] text-gold">▲</span>}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    </div>
  );
}

/** One player's season at a glance: floor, average and ceiling, his score spread, last five and next five. */
export default function CompareCard({ index, name, pos, summary: s, next, lead }: { index: number; name: string; pos: string; summary: PlayerSummary; next: NextGame[] | null; lead: CardLeads }) {
  const c = `var(--slot-${index})`;
  return (
    <article data-testid="compare-card" className="min-w-0 rounded-xl border p-3"
      style={{ borderColor: `color-mix(in srgb, ${c} 30%, var(--line))`, background: `linear-gradient(165deg, color-mix(in srgb, ${c} 24%, var(--surface)) 0%, var(--surface) 40%)` }}>
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-bold" style={{ color: c }}>{name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</span>
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{name}</h3>
          <p className="text-xs text-muted">{pos} · {s.team} · {s.games}G · {s.total.toFixed(1)} pts</p>
        </div>
      </div>
      <div className="my-2.5 grid grid-cols-3 gap-1.5">
        <Stat id="floor" label="Floor" value={s.floor} lead={lead.floor} />
        <Stat id="avg" label="Average" value={s.avg} lead={lead.avg} />
        <Stat id="ceil" label="Ceiling" value={s.ceil} lead={lead.ceil} />
      </div>
      <ScoreHistogram bins={s.bins} avg={s.avg} index={index} />
      <p className="mt-2 text-xs text-muted">
        Consistency: <b className={lead.cv ? 'text-gold' : 'text-ink'}>CV {s.cv === null ? '—' : `${Math.round(s.cv * 100)}%`}</b>
        {lead.cv && <span className="text-gold"> ▲ steadiest</span>}
      </p>
      <h4 className="mb-1 mt-3 text-[10.5px] uppercase tracking-wider text-muted">Last 5 games</h4>
      {s.last5.length === 0 ? <p className="text-xs text-muted">No games yet</p> : (
        <ul className="overflow-hidden rounded-lg border border-line text-[13px]">
          {s.last5.map((g) => (
            <li key={g.week} className="flex justify-between border-b border-line px-2.5 py-1 last:border-0">
              <span className="w-8 text-muted">W{g.week}</span>
              <span className="flex-1">{g.home === false ? '@' : ''}{g.opp}</span>
              <span className={`num font-semibold ${s.avg !== null && g.pts >= s.avg ? 'text-win' : ''}`}>{g.pts.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      )}
      {next && (
        <>
          <h4 className="mb-1 mt-3 text-[10.5px] uppercase tracking-wider text-muted">Next 5 · vs {POS_NAME[pos] ?? pos}</h4>
          <ul className="grid grid-cols-5 gap-1">
            {next.map((g) => (
              <li key={g.week} title={g.rank !== null ? `#${g.rank} of ${g.of} in points allowed to ${POS_NAME[pos] ?? pos}` : undefined}
                className="rounded-md bg-surface-2 py-1 text-center text-[11.5px]" style={{ borderBottom: `3px solid ${g.tone ? TONE[g.tone] : 'var(--dim)'}` }}>
                <span className="block text-[9.5px] text-muted">W{g.week}</span>
                {g.opp === null ? 'BYE' : `${g.home ? '' : '@'}${g.opp}`}
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
