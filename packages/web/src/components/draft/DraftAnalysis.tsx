import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import type { Draft, DraftPick, History, HistoryDraftPick, Manager, PlayerDirectory, PlayerId, UserId } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import { fmtSigned } from '../../lib/format';
import { POSITION_FILTERS, byPosition, leagueExtremes, letterGrade, managerDraftSummaries, type PositionFilter } from '../../lib/draft';
import TeamDraft from './TeamDraft';
import PickList, { type PickRow } from './PickList';

export const signClass = (n: number | null, fallback = 'text-muted') => (n === null || n === 0 ? fallback : n > 0 ? 'text-win' : 'text-loss');

interface Props {
  draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory; seasonTeams: Record<PlayerId, string>; inSeason: boolean;
  selected: UserId; onSelect: (userId: UserId) => void; history: History;
}

/** Card header in the style "small label / bold title". */
export function CardHeader({ label, title, aside }: { label: string; title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 border-b border-line px-4 pb-2 pt-3">
      <div>
        <div className="section-label">{label}</div>
        <div className="text-sm font-semibold uppercase tracking-wide">{title}</div>
      </div>
      {aside && <div className="text-xs text-muted">{aside}</div>}
    </div>
  );
}

export default function DraftAnalysis({ draft, managers, players, seasonTeams, inSeason, selected, onSelect, history }: Props) {
  const summaries = managerDraftSummaries(draft);
  const teams = draft.slotOrder.length;
  const [pos, setPos] = useState<PositionFilter>(null);
  const { steals, busts } = leagueExtremes(draft, Infinity);
  const maxAbs = Math.max(1, ...summaries.map((s) => Math.abs(s.totalValue)));
  const note = inSeason ? ' (to date)' : '';
  const seasonRows = (picks: DraftPick[]): PickRow[] => byPosition(picks, players, pos).map((p) => ({ pick: p, teams, manager: managers[p.userId]?.displayName ?? p.userId }));
  const allTimeRows = (picks: HistoryDraftPick[]): PickRow[] => byPosition(picks, players, pos).map((p) => ({ pick: p, teams: p.teams, manager: history.managers[p.userId]?.displayName ?? p.userId, year: p.year }));
  const empty = pos === null ? 'No picks yet.' : `No ${pos} picks here.`;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="card">
          <CardHeader label={`${inSeason ? 'To date' : 'Final'}`} title="Draft grades" aside={<Link to="/draft/grading" className="text-accent hover:underline">How grading works</Link>} />
          <ol>
            {summaries.map((s, i) => {
              const m = managers[s.userId];
              const rank = i + 1;
              const active = s.userId === selected;
              return (
                <li key={s.userId}>
                  <button
                    type="button"
                    onClick={() => onSelect(s.userId)}
                    aria-pressed={active}
                    className={`grid w-full grid-cols-[1.75rem_minmax(0,1fr)_2.5rem] items-center gap-3 border-t border-line px-4 py-2.5 text-left hover:bg-surface-2 ${active ? 'bg-surface-2' : ''}`}
                  >
                    <span className={`num grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${rank === 1 ? 'bg-accent/20 text-accent' : 'bg-surface-2 text-muted'}`}>{rank}</span>
                    <span className="min-w-0">
                      <span className="flex items-center justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2"><Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={20} /><span className="truncate text-sm font-medium">{m?.displayName ?? s.userId}</span></span>
                        <span className={`num text-sm font-semibold ${signClass(s.totalValue)}`}>{fmtSigned(s.totalValue, 0)}</span>
                      </span>
                      <span className="mt-1 block h-1 w-full overflow-hidden rounded bg-surface-2">
                        <span className={`block h-full rounded ${s.totalValue >= 0 ? 'bg-win' : 'bg-loss'}`} style={{ width: `${Math.round((Math.abs(s.totalValue) / maxAbs) * 100)}%` }} />
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted">
                        {s.beat} of {s.valued} picks beat their slot · {fmtSigned(s.hits, 0)} from the hits · {fmtSigned(s.misses, 0)} from the misses
                      </span>
                    </span>
                    <span className="text-right text-lg font-bold">{letterGrade(rank, summaries.length)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <TeamDraft draft={draft} managers={managers} players={players} seasonTeams={seasonTeams} userId={selected} onSelect={onSelect} inSeason={inSeason} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="section-label">Best and worst picks</div>
        <div role="group" aria-label="Position" className="flex overflow-hidden rounded border border-line text-xs">
          {[null, ...POSITION_FILTERS].map((f) => (
            <button key={f ?? 'all'} type="button" aria-pressed={pos === f} onClick={() => setPos(f)} className={`px-3 py-1.5 ${pos === f ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'}`}>{f ?? 'All'}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <PickList label={`Best picks${note}`} title="Top steals" rows={seasonRows(steals)} players={players} testId="steals" empty={empty} />
        <PickList label={`Worst picks${note}`} title="Top busts" rows={seasonRows(busts)} players={players} testId="busts" empty={empty} />
        <PickList label="All time" title="Best draft values" aside="Completed seasons" rows={allTimeRows(history.topDraftValues)} players={players} testId="all-time-best" empty={history.topDraftValues.length ? empty : 'No completed seasons yet.'} />
        <PickList label="All time" title="Worst draft values" aside="Completed seasons" rows={allTimeRows(history.worstDraftValues)} players={players} testId="all-time-worst" empty={history.worstDraftValues.length ? empty : 'No completed seasons yet.'} />
      </div>
    </div>
  );
}
