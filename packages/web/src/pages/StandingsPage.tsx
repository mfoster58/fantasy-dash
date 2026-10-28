import { useMemo, useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import Bracket from '../components/history/Bracket';
import StandingsTable from '../components/StandingsTable';
import SeasonPicker from '../components/SeasonPicker';
import StatTable from '../components/stats/StatTable';
import { history } from '../data/load';
import { standingsBrackets } from '../lib/standings/brackets';
import { managerRefs } from '../lib/stats/scope';
import { statTable } from '../lib/stats/table';

type View = 'standard' | 'advanced';
const VIEW_KEY = 'standings-view';
/** the table you last chose, remembered in this browser; storage can be blocked, so it falls back to standard */
const savedView = (): View => { try { return localStorage.getItem(VIEW_KEY) === 'advanced' ? 'advanced' : 'standard'; } catch { return 'standard'; } };

/** the season, and the last finished one before it, whose bracket shows where each seed goes */
export interface StandingsData { season: Season; template: Season | null }

function BracketSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function StandingsPage() {
  const { season, template } = useLoaderData() as StandingsData;
  const navigate = useNavigate();
  const years = history.seasons.map((s) => s.year);
  const note = season.status === 'in_season' ? `through week ${season.lastScoredWeek}` : 'final';
  const brackets = standingsBrackets(season, template);
  const caption = brackets.kind === 'projected' ? 'If the season ended today: seeded from the table above.' : null;
  const [view, setView] = useState<View>(savedView);
  const pick = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage blocked: the choice lasts this visit */ } };
  // the Stats page's Season stats table, for this season alone
  const advanced = useMemo(() => (view === 'advanced' ? { rows: statTable([season]), refs: managerRefs([season]) } : null), [view, season]);
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight">
          Standings <span className="num font-normal text-muted">{season.year}</span>{' '}
          <span className="ml-1 text-sm font-normal text-muted">{note}</span>
        </h1>
        <SeasonPicker years={years} value={season.year} onChange={(y) => navigate(`/standings/${y}`)} />
      </header>
      <div role="group" aria-label="Table" className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm">
        {([['standard', 'Standard'], ['advanced', 'Advanced']] as const).map(([v, label]) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => pick(v)}
            className={`rounded-md px-3 py-1 transition-colors ${view === v ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'}`}>{label}</button>
        ))}
      </div>
      {advanced
        ? <div className="card px-1 py-2"><StatTable rows={advanced.rows} refs={advanced.refs} pin={null} allTime={false} /></div>
        : <StandingsTable rows={season.standings} managers={season.managers} playoffTeams={season.playoffTeams} year={season.year} />}
      <p className="text-xs text-muted">
        {advanced
          ? 'Every advanced stat, regular season unless the column says otherwise. Click a column to rank by it; hover for its definition.'
          : `Regular season only. Click a column to sort by it; hover for its definition. Top ${season.playoffTeams} make the playoffs.`}
      </p>
      {brackets.kind !== 'none' && (
        <div className="space-y-8 pt-4">
          <BracketSection title="Playoffs">
            {caption && <p className="text-sm text-muted">{caption}</p>}
            <Bracket games={brackets.winners} kind="winners" managers={season.managers} year={season.year} seeds={brackets.seeds} />
          </BracketSection>
          {brackets.consolation.length > 0 && (
            <BracketSection title="Toilet bowl">
              {caption && <p className="text-sm text-muted">{caption}</p>}
              <Bracket games={brackets.consolation} kind="consolation" managers={season.managers} year={season.year} seeds={brackets.seeds} />
            </BracketSection>
          )}
        </div>
      )}
    </section>
  );
}
