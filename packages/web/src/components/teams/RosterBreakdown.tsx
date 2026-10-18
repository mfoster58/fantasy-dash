import { useState } from 'react';
import type { PlayerDirectory, PlayerId } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPts } from '../../lib/format';
import { playerName, playerTeam, posColor } from '../../lib/players';
import { PlayerLink } from '../NameLink';
import type { PositionGroup, PositionPlayer } from '../../lib/teamProfile';

interface Props { positions: PositionGroup[]; neverStarted: PositionPlayer[]; players: PlayerDirectory; seasonTeams: Record<PlayerId, string>; weeksPlayed: number }

type Mode = 'points' | 'ppg';
const GROUP_NAMES: Record<string, string> = { QB: 'Quarterbacks', RB: 'Running backs', WR: 'Wide receivers', TE: 'Tight ends', K: 'Kickers', DEF: 'Defenses' };
const PREVIEW = 4;
/** starts needed for a points-per-start figure to count */
export const MIN_STARTS = 3;
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** In PPG mode, players with enough starts rank by points per start; the rest trail in start order. */
export function orderPlayers(players: PositionPlayer[], mode: Mode): PositionPlayer[] {
  if (mode === 'points') return players;
  const eligible = players.filter((p) => p.starts >= MIN_STARTS).sort((a, b) => (b.ppg ?? 0) - (a.ppg ?? 0) || b.started - a.started);
  const rest = players.filter((p) => p.starts < MIN_STARTS).sort((a, b) => b.starts - a.starts || b.started - a.started);
  return [...eligible, ...rest];
}

function Expandable({ items, render, more }: { items: PositionPlayer[]; render: (p: PositionPlayer) => React.ReactNode; more: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, PREVIEW);
  return (
    <>
      <ul className="divide-y divide-line">{shown.map(render)}</ul>
      {items.length > PREVIEW && (
        <button type="button" onClick={() => setAll((v) => !v)} className="w-full border-t border-line px-3 py-1.5 text-left text-xs text-muted hover:text-ink">
          {all ? 'Show fewer' : `Show ${items.length - PREVIEW} more${more}`}
        </button>
      )}
    </>
  );
}

function Group({ g, bench, players, seasonTeams, weeksPlayed, mode }: { g: PositionGroup; bench: PositionPlayer[]; players: PlayerDirectory; seasonTeams: Record<PlayerId, string>; weeksPlayed: number; mode: Mode }) {
  const regular = Math.max(1, Math.ceil(weeksPlayed / 2));
  const color = posColor(g.pos);
  const rankChip = (p: PositionPlayer) => p.posRank !== null && <span className="num ml-1.5 rounded border border-line px-1 text-[10px] text-muted" title={`${p.position}${p.posRank} this season by points`}>{p.position}{p.posRank}</span>;
  const row = (p: PositionPlayer, started: boolean) => {
    const eligible = p.starts >= MIN_STARTS;
    const tinted = started && mode === 'points' && p.starts >= regular;
    return (
      <li key={p.playerId} data-regular={tinted ? 'true' : undefined}
        className={`flex items-center gap-2.5 px-3 py-1.5 text-sm ${tinted ? 'bg-[color-mix(in_srgb,var(--pos-color)_10%,transparent)]' : ''} ${started && (mode === 'points' || eligible) ? '' : 'text-muted'}`}
        style={{ '--pos-color': color } as React.CSSProperties}>
        <Headshot players={players} id={p.playerId} size={26} />
        <span className="min-w-0 flex-1 truncate">
          <PlayerLink id={p.playerId} className={started ? 'font-medium' : ''}>{playerName(players, p.playerId)}</PlayerLink>
          <span className="ml-1.5 text-xs text-muted">{playerTeam(players, p.playerId, seasonTeams)}</span>
          {rankChip(p)}
        </span>
        {!started
          ? <span className="num text-xs">{p.bench > 0 ? fmtPts(p.bench) : '—'}</span>
          : mode === 'points'
            ? <span className="text-right"><span className="num block font-semibold leading-tight">{fmtPts(p.started)}</span><span className="num block text-[10px] text-muted">{p.starts} start{p.starts === 1 ? '' : 's'}</span></span>
            : <span className="text-right"><span className="num block font-semibold leading-tight">{eligible && p.ppg !== null ? fmtPts(p.ppg) : '—'}</span><span className="num block text-[10px] text-muted">{p.starts} start{p.starts === 1 ? '' : 's'}</span></span>}
      </li>
    );
  };
  return (
    <section className="card overflow-hidden" data-testid={`group-${g.pos}`}>
      <header className="flex items-center gap-3 border-b border-line px-3 py-2.5">
        <span className="num text-2xl font-bold leading-none" style={{ color }}>{g.pos}</span>
        <span className="section-label flex-1">{GROUP_NAMES[g.pos] ?? g.pos}</span>
        <span className="num text-lg font-semibold">{fmtPts(g.started)} <span className="text-[10px] font-normal text-muted">pts</span></span>
      </header>
      {g.players.length === 0 && bench.length === 0 && <p className="px-3 py-2 text-xs text-muted">Nobody rostered.</p>}
      <Expandable items={orderPlayers(g.players, mode)} render={(p) => row(p, true)} more="" />
      {bench.length > 0 && (
        <>
          <div className="section-label border-t border-line bg-surface-2 px-3 py-1 text-[10px]">Never started</div>
          <Expandable items={bench} render={(p) => row(p, false)} more=" never started" />
        </>
      )}
    </section>
  );
}

/** Where the points came from (stacked share bar with the league's shares beneath), rank chips and a card per position, by total started points or points per start. */
export default function RosterBreakdown({ positions, neverStarted, players, seasonTeams, weeksPlayed }: Props) {
  const [mode, setMode] = useState<Mode>('points');
  return (
    <section className="space-y-3">
      <div className="card p-4">
        <CardHeader label="Depth chart" title="Roster" aside={
          <span className="flex items-center gap-2">
            <span className="hidden text-muted sm:inline">Thin bar: league average</span>
            <span className="flex rounded-full bg-surface-2 p-0.5" role="group" aria-label="Rank players by">
              {([['points', 'Points'], ['ppg', 'PPG']] as const).map(([id, label]) => (
                <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)} title={id === 'ppg' ? `Points per start, at least ${MIN_STARTS} starts` : 'Total points while started'}
                  className={`rounded-full px-2.5 py-0.5 text-xs ${mode === id ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}>{label}</button>
              ))}
            </span>
          </span>
        } />
        <div className="section-label mt-3">Where the points came from</div>
        <div className="mt-1.5 flex h-6 overflow-hidden rounded" aria-hidden="true">
          {positions.map((g) => (
            <span key={g.pos} data-testid={`share-${g.pos}`} className="num flex items-center justify-center overflow-hidden whitespace-nowrap text-[11px] font-semibold text-bg"
              style={{ width: pct(g.share), background: posColor(g.pos) }}>
              {g.share >= 0.08 ? `${g.pos} ${pct(g.share)}` : ''}
            </span>
          ))}
        </div>
        <div className="mt-1 flex h-1 overflow-hidden rounded" aria-hidden="true">
          {positions.map((g) => <span key={g.pos} style={{ width: pct(g.leagueShare), background: posColor(g.pos), opacity: 0.6 }} />)}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {positions.map((g) => (
            <span key={g.pos} data-testid={`rank-${g.pos}`} className="num rounded border border-line px-1.5 py-0.5 text-[11px]" title={`${fmtPts(g.started)} started points at ${g.pos}, rank ${g.rank} in the league`}>
              <span className="font-semibold" style={{ color: posColor(g.pos) }}>{g.pos}</span> {g.rank}
            </span>
          ))}
        </div>
        {mode === 'ppg' && <p className="mt-2 text-xs text-muted">Points per start; players with fewer than {MIN_STARTS} starts trail the list.</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {positions.map((g) => <Group key={g.pos} g={g} bench={neverStarted.filter((p) => p.position === g.pos)} players={players} seasonTeams={seasonTeams} weeksPlayed={weeksPlayed} mode={mode} />)}
      </div>
    </section>
  );
}
