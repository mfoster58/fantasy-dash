import { useEffect, useState } from 'react';
import { Link, useLoaderData, useNavigate, useSearchParams } from 'react-router';
import type { Season, UserId } from '@fantasy-dash/core';
import SeasonPicker from '../components/SeasonPicker';
import DraftBoard, { type BoardMode } from '../components/draft/DraftBoard';
import DraftAnalysis from '../components/draft/DraftAnalysis';
import { history, players } from '../data/load';

export default function DraftPage() {
  const season = useLoaderData() as Season;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // ?team=<userId> (from a Records row) opens on that manager: column highlighted, team shown below
  const teamParam = params.get('team');
  const team = teamParam && season.draft?.slotOrder.includes(teamParam) ? teamParam : null;
  const [mode, setMode] = useState<BoardMode>('value');
  const [highlight, setHighlight] = useState<UserId | null>(team);
  const [selected, setSelected] = useState<UserId | null>(team);
  // a new year or a new team param resets the selection, so a manager from last year's board is never left highlighted
  useEffect(() => { setHighlight(team); setSelected(team); }, [team, season.year]);
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
        {season.draft.rounds} rounds · {season.draft.type} · click any pick to highlight that manager's column and see their team below · hover a pick for details{inSeason ? ' · values are to date' : ''} · <Link to={`/history/${season.year}`} className="text-accent hover:underline">season review</Link>
      </p>
      <DraftBoard draft={season.draft} managers={season.managers} players={players} seasonTeams={season.playerTeams} mode={mode} highlight={highlight} onHighlight={(u) => { setHighlight(u); if (u) setSelected(u); }} inSeason={inSeason} />
      <DraftAnalysis
        draft={season.draft} managers={season.managers} players={players} seasonTeams={season.playerTeams} inSeason={inSeason}
        selected={selected ?? season.draft.slotOrder[0]}
        onSelect={(u) => { setSelected(u); setHighlight(u); }}
        history={history}
      />
    </section>
  );
}
