import { useMemo, useState } from 'react';
import type { ChartDb, PlayerDb, PlayerId } from '@fantasy-dash/core';
import SeasonPicker from '../../SeasonPicker';
import { GROUPS } from '../../../lib/grades/defs';
import { gradeCards, scoutingSummary } from '../../../lib/grades/grade';
import GradeCard from './GradeCard';
import ScoutingSummary from './ScoutingSummary';

export const GRADES_CREDIT = 'Data: FTN Data via nflverse · Next Gen Stats, PFR, snap counts and play-by-play via nflverse';

/** Grade cards for one season at a time, led by a scouting summary; nothing when no season has grade data for him. */
export default function GradesSection({ id, dbs, charts }: { id: PlayerId; dbs: PlayerDb[]; charts: ChartDb[] }) {
  const graded = useMemo(() => dbs
    .map((db) => ({ year: db.year, cards: gradeCards(db, charts.find((c) => c.year === db.year), id) }))
    .filter((s): s is { year: number; cards: NonNullable<typeof s.cards> } => s.cards !== null)
    .sort((a, b) => b.year - a.year), [dbs, charts, id]);
  const [picked, setPicked] = useState<number | null>(null);
  const season = graded.find((s) => s.year === picked) ?? graded[0];
  const summary = useMemo(() => (season ? scoutingSummary(season.cards) : null), [season]);
  if (!season || !summary) return null;

  return (
    <section aria-labelledby="pp-grades" className="space-y-3">
      <div className="card flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <h2 id="pp-grades" className="text-sm font-semibold uppercase tracking-wide">Grades</h2>
        <SeasonPicker years={graded.map((s) => s.year)} value={season.year} onChange={(v) => { if (v !== 'all') setPicked(v); }} />
      </div>
      <ScoutingSummary best={summary.best} worst={summary.worst} />
      {GROUPS.map((group) => {
        const cards = season.cards.filter((c) => c.group === group);
        if (!cards.length) return null;
        return (
          <div key={group} className="space-y-2">
            <h3 data-testid="grade-group" className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">{group}</h3>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))]">
              {cards.map((c) => <GradeCard key={c.key} card={c} />)}
            </div>
          </div>
        );
      })}
      <p className="px-1 text-[11px] text-muted">{GRADES_CREDIT}</p>
    </section>
  );
}
