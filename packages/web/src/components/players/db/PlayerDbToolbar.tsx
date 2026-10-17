import { useEffect, useState } from 'react';
import SeasonPicker from '../../SeasonPicker';
import { TABS, type Tab } from '../../../lib/playerdb/columns';
import type { DbState } from '../../../lib/playerdb/url';

interface Props {
  state: DbState;
  onChange: (patch: Partial<DbState>) => void;
  years: number[];
  year: number;
  onYear: (y: number) => void;
  throughWeek: number;
  managers: { userId: string; name: string }[];
}

const TAB_LABELS: Record<Tab, string> = { all: 'All', qb: 'QB', rb: 'RB', wr: 'WR', te: 'TE' };
const pill = (on: boolean) => `rounded-full px-3 py-1 text-xs font-medium transition-colors ${on ? 'bg-ink text-bg' : 'bg-surface-2 text-muted hover:text-ink'}`;
const select = 'num rounded border border-line bg-surface px-2 py-1 text-ink';

/** Position tabs, season, week range, total/per-game, roster filter and search. Everything it changes lives in the URL. */
export default function PlayerDbToolbar({ state, onChange, years, year, onYear, throughWeek, managers }: Props) {
  const weeks = Array.from({ length: Math.max(1, throughWeek) }, (_, i) => i + 1);
  const [q, setQ] = useState(state.q);
  useEffect(() => { setQ(state.q); }, [state.q]);
  useEffect(() => {
    if (q === state.q) return;
    const t = setTimeout(() => onChange({ q }), 150);
    return () => clearTimeout(t);
  }, [q, state.q, onChange]);

  return (
    <div className="sticky top-12 z-[5] -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-bg/90 px-4 py-2 text-sm backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <div role="group" aria-label="Position" className="flex gap-1">
        {TABS.map((t) => (
          <button key={t} type="button" aria-pressed={state.tab === t} onClick={() => onChange({ tab: t })} className={pill(state.tab === t)}>{TAB_LABELS[t]}</button>
        ))}
      </div>
      <SeasonPicker years={years} value={year} onChange={(v) => { if (v !== 'all') onYear(v); }} />
      <div className="flex items-center gap-2 text-muted">
        <label className="flex items-center gap-1">From
          <select aria-label="From" value={state.from} onChange={(e) => onChange({ from: Number(e.target.value) })} className={select}>
            {weeks.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">To
          <select aria-label="To" value={state.to} onChange={(e) => onChange({ to: Number(e.target.value) })} className={select}>
            {weeks.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </label>
        <button type="button" onClick={() => onChange({ from: Math.max(1, throughWeek - 3), to: Math.max(1, throughWeek) })} className={pill(false)}>Last 4</button>
        <button type="button" onClick={() => onChange({ from: 1, to: Math.max(1, throughWeek) })} className={pill(false)}>Season</button>
      </div>
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
      <input type="search" aria-label="Search players" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1 text-ink sm:max-w-56" />
    </div>
  );
}
