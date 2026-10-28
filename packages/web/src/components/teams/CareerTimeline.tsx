import type { CSSProperties } from 'react';
import type { PlayerDirectory } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import { FinishIcon, type FinishKind } from '../Icons';
import { ordinal } from '../../lib/charts/scale';
import type { TimelineStop } from '../../lib/careerTimeline';
import { playerName } from '../../lib/players';

const FINISH: Record<FinishKind, { colour: string; caption: string }> = {
  champion: { colour: 'var(--gold)', caption: 'Champion' },
  runnerUp: { colour: 'var(--silver)', caption: 'Runner-up' },
  third: { colour: 'var(--bronze)', caption: 'Third place' },
  toilet: { colour: 'var(--ink)', caption: 'Last place' },
};

function Medal({ s }: { s: TimelineStop }) {
  const f = s.finish ? FINISH[s.finish] : null;
  const colour = f ? f.colour : s.live ? 'var(--accent)' : 'var(--dim)';
  return (
    <div className="relative z-10 mx-auto grid size-20 place-items-center rounded-full border-2" style={{
      borderColor: colour,
      background: `radial-gradient(circle at 50% 35%, color-mix(in srgb, ${colour} 22%, var(--surface)), var(--surface) 70%)`,
      boxShadow: `0 0 0 6px color-mix(in srgb, ${colour} 10%, transparent)`,
    } as CSSProperties}>
      {s.finish ? <FinishIcon kind={s.finish} size="2.4em" /> : <span className="font-display text-[26px] font-bold leading-none" style={{ color: s.live ? 'var(--accent)' : 'var(--muted)' }}>{s.rank ? ordinal(s.rank) : '–'}</span>}
      <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: colour, color: colour }}>
        {f ? f.caption : s.live ? 'So far' : 'Regular season'}
      </span>
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between border-t border-line py-1 text-[13px]"><span>{label}</span><b className="num font-semibold">{value}</b></div>
);

/** A manager's career, one stop per season: how it ended, the record, and the player who carried him. Every season card is the same height. */
export default function CareerTimeline({ stops, players }: { stops: TimelineStop[]; players: PlayerDirectory }) {
  return (
    <section aria-labelledby="career-timeline" className="card p-4">
      <h2 id="career-timeline" className="text-sm font-semibold uppercase tracking-wide">Career timeline</h2>
      <p className="mb-4 text-xs text-muted">One stop per season: how it ended, the record, and the player who carried him.</p>
      <div className="relative overflow-x-auto pb-1">
        {/* the line the medals sit on */}
        <span aria-hidden className="absolute inset-x-[10%] top-10 h-0.5 bg-[linear-gradient(90deg,var(--line),var(--accent)_50%,var(--line))]" />
        <ol className="relative grid gap-3" style={{ gridTemplateColumns: `repeat(${stops.length}, minmax(12.5rem, 1fr))` }}>
          {stops.map((s) => (
            <li key={s.year} data-testid="timeline-stop" className="flex flex-col">
              <Medal s={s} />
              <div className="mt-5 flex flex-1 flex-col rounded-xl border border-line bg-[linear-gradient(180deg,var(--surface-2),color-mix(in_srgb,var(--surface-2)_60%,var(--bg)))] px-3 py-2.5">
                <div className="font-display text-xl font-bold leading-none">{s.year}{s.live && <span className="ml-1.5 font-sans text-[11px] font-semibold text-accent">in progress</span>}</div>
                <div className="mb-2 mt-1 truncate text-[12.5px] text-muted" title={s.teamName}>{s.teamName}</div>
                <Row label="Record" value={`${s.w}–${s.l}${s.t ? `–${s.t}` : ''}`} />
                <Row label="Regular season" value={s.rank ? ordinal(s.rank) : '–'} />
                <Row label="Points for" value={s.pf === null ? '–' : Math.round(s.pf).toLocaleString('en-US')} />
                {/* the tag row keeps its height so every card lines up */}
                <div className="min-h-[26px] pt-2">{s.pointsTitle && <span className="rounded-full bg-gold/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gold">Points title</span>}</div>
                {s.top && (
                  <div className="mt-auto flex items-center gap-2 border-t border-line pt-2">
                    <Headshot players={players} id={s.top.playerId} size={34} />
                    <div className="min-w-0 text-xs leading-tight">
                      <div className="truncate">{playerName(players, s.top.playerId)}</div>
                      <div className="text-muted">{s.top.position} · {Math.round(s.top.points)} pts started</div>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
