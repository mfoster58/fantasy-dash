import { useEffect, useState } from 'react';
import SeasonPicker from '../../SeasonPicker';
import WeekPicker from './WeekPicker';
import { TABS, type Tab } from '../../../lib/playerdb/columns';
import type { DbState } from '../../../lib/playerdb/url';

interface Props {
  state: DbState;
  onChange: (patch: Partial<DbState>) => void;
  years: number[];
  year: number | 'all';
  onYear: (y: number | 'all') => void;
  throughWeek: number;
  /** first fantasy playoff week, for the gap in the week row */
  playoffAt?: number | null;
  managers: { userId: string; name: string }[];
  /** the NFL teams in the table, for the team filter */
  teams: string[];
}

const TAB_LABELS: Record<Tab, string> = { all: 'All', qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE' };
const pill = (on: boolean) => `rounded-full px-3 py-1 text-xs font-medium transition-colors ${on ? 'bg-ink text-bg' : 'bg-surface-2 text-muted hover:text-ink'}`;
/** the NFL regular season, which the player database covers */
const NFL_WEEKS = 18;
const select = 'num rounded border border-line bg-surface px-2 py-1 text-ink';

/** Position tabs, season, week range, total/per-game, roster filter and search. Everything it changes lives in the URL. */
export default function PlayerDbToolbar({ state, onChange, years, year, onYear, throughWeek, playoffAt = null, managers, teams }: Props) {
  const [q, setQ] = useState(state.q);
  useEffect(() => { setQ(state.q); }, [state.q]);
  useEffect(() => {
    if (q === state.q) return;
    const t = setTimeout(() => onChange({ q }), 150);
    return () => clearTimeout(t);
  }, [q, state.q, onChange]);

  return (
    <div className="sticky top-12 z-[5] -mx-4 space-y-2 border-b border-line bg-bg/90 px-4 py-2 text-sm backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div role="group" aria-label="Position" className="flex gap-1">
          {TABS.map((t) => (
            <button key={t} type="button" aria-pressed={state.tab === t} onClick={() => onChange({ tab: t })} className={pill(state.tab === t)}>{TAB_LABELS[t]}</button>
          ))}
        </div>
        <SeasonPicker years={years} value={year} onChange={onYear} allTime />
        <div role="group" aria-label="Mode" className="flex gap-1">
          <button type="button" aria-pressed={state.mode === 'total'} onClick={() => onChange({ mode: 'total' })} className={pill(state.mode === 'total')}>Total</button>
          <button type="button" aria-pressed={state.mode === 'pg'} onClick={() => onChange({ mode: 'pg' })} className={pill(state.mode === 'pg')}>Per game</button>
        </div>
        <label className="flex items-center gap-2 text-muted">Roster
          <select aria-label="Roster" value={state.roster} onChange={(e) => onChange({ roster: e.target.value })} className={select}>
            <option value="all">All players</option>
            <option value="rostered">Rostered</option>
            <option value="fa">Free agents</option>
            {managers.map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-muted">Team
          <select aria-label="NFL team" value={state.team} onChange={(e) => onChange({ team: e.target.value })} className={select}>
            <option value="all">All teams</option>
            {teams.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        {/* a rookie is a first-year player in one season; across every season it means nothing */}
        {year !== 'all' && <button type="button" aria-pressed={state.rookies} onClick={() => onChange({ rookies: !state.rookies })} className={pill(state.rookies)}>Rookies</button>}
        <input type="search" aria-label="Search players" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1 text-ink sm:max-w-56" />
      </div>
      {/* week numbers mean nothing across seasons */}
      {year !== 'all' && <WeekPicker from={state.from} to={state.to} throughWeek={throughWeek} lastWeek={NFL_WEEKS} playoffAt={playoffAt} onChange={onChange} />}
    </div>
  );
}
