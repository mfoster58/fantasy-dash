import { useState } from 'react';
import { Link, useLoaderData, useNavigate } from 'react-router';
import type { Season, UserId } from '@fantasy-dash/core';
import SeasonPicker from '../components/SeasonPicker';
import DraftBoard, { type BoardMode } from '../components/draft/DraftBoard';
import DraftAnalysis from '../components/draft/DraftAnalysis';
import { history, players } from '../data/load';

export default function DraftPage() {
  const season = useLoaderData() as Season;
  const navigate = useNavigate();
  const [mode, setMode] = useState<BoardMode>('position');
  const [highlight, setHighlight] = useState<UserId | null>(null);
  const years = history.seasons.map((s) => s.year);
  const inSeason = season.status === 'in_season';
  if (!season.draft) return <p className="text-sm text-muted">No draft recorded for {season.year}.</p>;
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold">Draft <span className="num font-normal text-muted">{season.year}</span></h1>
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Color by" className="flex overflow-hidden rounded border border-line text-xs">
            {(['position', 'value'] as BoardMode[]).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`px-3 py-1.5 capitalize ${mode === m ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'}`}>{m}</button>
            ))}
          </div>
          <SeasonPicker years={years} value={season.year} onChange={(y) => navigate(`/draft/${y}`)} />
        </div>
      </header>
      <p className="text-xs text-muted">
        {season.draft.rounds} rounds · {season.draft.type} · click a manager to highlight their picks · hover a pick for details{inSeason ? ' · values are to date' : ''} · <Link to={`/history/${season.year}`} className="text-accent hover:underline">season review</Link>
      </p>
      <DraftBoard draft={season.draft} managers={season.managers} players={players} mode={mode} highlight={highlight} onHighlight={setHighlight} inSeason={inSeason} />
      <DraftAnalysis draft={season.draft} managers={season.managers} players={players} inSeason={inSeason} />
    </section>
  );
}
