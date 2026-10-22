import { useMemo, useState, type ReactNode } from 'react';
import type { Season } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import { PlayerLink } from '../NameLink';
import { history, players } from '../../data/load';
import { MODEL_BOARDS, TD_BOARDS, YARD_BOARDS, homeLeaderContext, type Split } from '../../lib/home/leaders';
import { leadPoints, type BoardRow } from '../../lib/playerBoards';
import type { PosFilter } from '../../lib/playerLines';
import { playerName } from '../../lib/players';

const POSITIONS: PosFilter[] = ['All', 'QB', 'RB', 'WR', 'TE'];
const SPLITS: { id: Split; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'pass', label: 'Pass' }, { id: 'rush', label: 'Rush' }, { id: 'rec', label: 'Rec' }];
const chip = (on: boolean) => `rounded-full border px-2.5 py-0.5 font-display text-xs font-bold uppercase tracking-wider ${on ? 'border-gold bg-gold text-[var(--on-chip)]' : 'border-line text-muted hover:text-ink'}`;

function Toggle<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)} className={chip(o.id === value)}>{o.label}</button>)}
    </div>
  );
}

function Column({ title, rows, season, spotlight = true, control }: { title: string; rows: BoardRow[]; season: Season; spotlight?: boolean; control?: ReactNode }) {
  const top = rows.slice(0, 5);
  const max = Math.max(...top.map((r) => Math.abs(r.value)), 1);
  const team = (r: BoardRow) => (r.userId ? season.managers[r.userId]?.teamName ?? season.managers[r.userId]?.displayName ?? '' : '');
  const [lead, ...rest] = spotlight ? top : [undefined, ...top];
  return (
    <section aria-label={title} className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-display text-xl font-bold uppercase leading-none tracking-[0.06em] text-gold">{title}</h3>
        {control}
      </div>
      {!top.length && <p className="text-sm text-muted">No leaders yet.</p>}
      {lead && (
        <div className="mb-1 grid grid-cols-[64px_1fr] items-end gap-3.5 rounded-xl border border-gold/30 bg-gold/10 p-3">
          <Headshot players={players} id={lead.playerId!} size={64} />
          <div className="min-w-0">
            <PlayerLink id={lead.playerId!} className="block truncate font-semibold">{playerName(players, lead.playerId!)}</PlayerLink>
            <div className="truncate text-xs text-muted">{team(lead)}</div>
            <div className="num text-2xl font-semibold text-gold">{lead.valueLabel}</div>
          </div>
        </div>
      )}
      <ol>
        {rest.filter(Boolean).map((r) => (
          <li key={r!.key} className="grid grid-cols-[28px_1fr_auto] items-center gap-2.5 border-b border-line/60 py-2">
            <Headshot players={players} id={r!.playerId!} size={28} />
            <div className="min-w-0">
              <PlayerLink id={r!.playerId!} className="block truncate text-sm">{playerName(players, r!.playerId!)}</PlayerLink>
              <div className="mt-1 h-1 rounded-full bg-surface-2"><div className="h-1 rounded-full bg-gold" style={{ width: `${(Math.abs(r!.value) / max) * 100}%` }} /></div>
            </div>
            <span className="num text-sm">{r!.valueLabel}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function LeadersBand({ seasons, season }: { seasons: Season[]; season: Season }) {
  const ctxOf = useMemo(() => homeLeaderContext(seasons, players, history.managers, season.year), [seasons, season.year]);
  const [pos, setPos] = useState<PosFilter>('All');
  const [yards, setYards] = useState<Split>('all');
  const [tds, setTds] = useState<Split>('all');
  const [model, setModel] = useState<'fpoe' | 'xfp'>('fpoe');
  const ctx = useMemo(() => ctxOf(pos), [ctxOf, pos]);
  return (
    <section aria-label="League leaders" className="leaders-band -mx-4 px-4 py-7 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="section-label text-gold">{season.year} · through week {season.lastScoredWeek}</div>
          <h2 className="font-display text-4xl font-bold uppercase leading-none">League leaders</h2>
        </div>
        <Toggle label="Position" options={POSITIONS.map((p) => ({ id: p, label: p }))} value={pos} onChange={setPos} />
      </div>
      {/* same split as the rows above: three boards over the wide column, the model board over the 330px rail */}
      <div className="grid gap-x-4 gap-y-6 lg:grid-cols-[1fr_330px]">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Column title="Most points" rows={leadPoints(ctx)} season={season} />
          <Column title="Most yards" rows={YARD_BOARDS[yards](ctx)} season={season} control={<Toggle label="Yards split" options={SPLITS} value={yards} onChange={setYards} />} />
          <Column title="Most touchdowns" rows={TD_BOARDS[tds](ctx)} season={season} control={<Toggle label="Touchdowns split" options={SPLITS} value={tds} onChange={setTds} />} />
        </div>
        <Column title="Beating the model" rows={MODEL_BOARDS[model](ctx, 'desc')} season={season} spotlight={false}
          control={<Toggle label="Model" options={[{ id: 'fpoe' as const, label: 'FPOE' }, { id: 'xfp' as const, label: 'xFP' }]} value={model} onChange={setModel} />} />
      </div>
    </section>
  );
}
