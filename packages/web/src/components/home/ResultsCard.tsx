import type { Season, Week } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import { weekHitters, type Hitter } from '../../lib/home/results';
import CardHead from './CardHead';

const KIND: Record<Hitter['kind'], { label: string; tone: string }> = {
  high: { label: 'High score', tone: 'text-win' },
  blowout: { label: 'Blowout', tone: 'text-coral' },
  nail: { label: 'Nail-biter', tone: 'text-accent' },
};

export default function ResultsCard({ season, week }: { season: Season; week: Week }) {
  const name = (u: string) => season.managers[u]?.displayName ?? u;
  return (
    <section aria-label={`Week ${week.week}`} className="card overflow-hidden">
      <CardHead over="Results" title={`Week ${week.week}`} to={`/scores/${season.year}/${week.week}`} link="Scores" />
      {weekHitters(week).map((h) => {
        const m = season.managers[h.userId];
        return (
          <div key={h.kind} className="grid grid-cols-[30px_1fr_auto] items-center gap-2.5 border-b border-line px-4 py-2.5 last:border-b-0">
            <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={30} />
            <div className="min-w-0 leading-tight">
              <div className={`font-display text-[11px] font-bold uppercase tracking-[0.14em] ${KIND[h.kind].tone}`}>{KIND[h.kind].label}</div>
              {h.kind === 'high'
                ? <span>{name(h.userId)}{m?.teamName && <span className="text-muted"> · {m.teamName}</span>}</span>
                : <span>{name(h.userId)} over {name(h.loser!)}</span>}
            </div>
            <b className="num">{h.kind === 'high' ? h.value.toFixed(2) : `+${h.value.toFixed(1)}`}</b>
          </div>
        );
      })}
    </section>
  );
}
