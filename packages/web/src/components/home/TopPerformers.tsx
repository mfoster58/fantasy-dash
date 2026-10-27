import { useState } from 'react';
import type { Season, Week } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import { PlayerLink } from '../NameLink';
import { players } from '../../data/load';
import { fullStatLine, topPerformers } from '../../lib/home/results';
import { playerName, playerPos } from '../../lib/players';
import CardHead from './CardHead';

const POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

export default function TopPerformers({ season, week }: { season: Season; week: Week }) {
  const [pos, setPos] = useState('All');
  const top = topPerformers(week, players, 5, pos);
  return (
    <section aria-label={`Week ${week.week} top performers`} className="card overflow-hidden">
      <CardHead over={`Week ${week.week}`} title="Top performers" to="/stats/players" link="Players" />
      <div role="group" aria-label="Position" className="flex flex-wrap gap-1 border-b border-line px-4 py-2">
        {POSITIONS.map((p) => (
          <button key={p} type="button" aria-pressed={p === pos} onClick={() => setPos(p)}
            className={`rounded-full border px-2 py-0.5 font-display text-xs font-bold uppercase tracking-wider ${p === pos ? 'border-accent bg-accent text-[var(--on-chip)]' : 'border-line text-muted hover:text-ink'}`}>{p}</button>
        ))}
      </div>
      {!top.length && <p className="px-4 py-3 text-sm text-muted">No {pos} started in week {week.week}.</p>}
      <ol>
        {top.map((p) => (
          <li key={p.playerId} className="grid grid-cols-[32px_1fr_auto] items-center gap-2.5 border-b border-line px-4 py-2.5 last:border-b-0">
            <Headshot players={players} id={p.playerId} size={32} />
            <div className="min-w-0 leading-tight">
              <div><PlayerLink id={p.playerId} className="font-semibold">{playerName(players, p.playerId)}</PlayerLink> <span className="text-xs text-muted">{playerPos(players, p.playerId)}</span></div>
              <div className="text-xs">{season.managers[p.userId]?.displayName ?? p.userId}</div>
              <div className="text-xs text-muted">{fullStatLine(p.stats)}</div>
            </div>
            <b className="num">{p.points.toFixed(1)}</b>
          </li>
        ))}
      </ol>
    </section>
  );
}
