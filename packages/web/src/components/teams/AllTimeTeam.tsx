import { useState } from 'react';
import { Link } from 'react-router';
import type { PlayerDirectory, UserId } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPpg, fmtPts, fmtTag } from '../../lib/format';
import { playerName, posColor } from '../../lib/players';
import type { AllTimeTeam as Team, GamePick, SeasonPick, Slot } from '../../lib/allTimeTeam';

type Mode = 'season' | 'game';
const MODES: [Mode, string][] = [['season', 'Season'], ['game', 'Single game']];

/** The best season and the best single game at every lineup slot from everyone who has been on the roster. */
export default function AllTimeTeam({ team, players, userId }: { team: Team; players: PlayerDirectory; userId: UserId }) {
  const [mode, setMode] = useState<Mode>('season');
  const rankChip = (p: SeasonPick) => p.posRank !== null && <span className="num ml-1.5 rounded border border-line px-1 text-[10px] text-muted" title={`${p.position}${p.posRank} that season by points`}>{p.position}{p.posRank}</span>;
  return (
    <section className="card">
      <CardHeader title="All-time team" aside={
        <span className="flex rounded-full bg-surface-2 p-0.5" role="group" aria-label="All-time team by">
          {MODES.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)} className={`rounded-full px-2.5 py-0.5 text-xs ${mode === id ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}>{label}</button>
          ))}
        </span>
      } />
      <ul className="divide-y divide-line" data-mode={mode}>
        {mode === 'season'
          ? team.season.map(({ slot, pick }, i) => (
            <li key={`${slot}-${i}`}>
              <Link to={pick ? `/teams/${pick.year}/${userId}` : '#'} className={`flex items-center gap-3 px-4 py-2 text-sm ${pick ? 'hover:bg-surface-2' : 'pointer-events-none text-muted'}`}>
                <span className="num w-10 shrink-0 text-xs font-bold" style={{ color: pick ? posColor(pick.position) : 'var(--muted)' }}>{slot}</span>
                {pick ? (
                  <>
                    <Headshot players={players} id={pick.playerId} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{playerName(players, pick.playerId)}{rankChip(pick)}</span>
                      <span className="num block text-xs text-muted">{pick.year} · {pick.games} game{pick.games === 1 ? '' : 's'}</span>
                    </span>
                    <span className="text-right"><span className="num block font-semibold leading-tight">{fmtPts(pick.points)}</span><span className="num block text-[10px] text-muted">{fmtPpg(pick.ppg)} PPG</span></span>
                  </>
                ) : <span className="text-xs">—</span>}
              </Link>
            </li>
          ))
          : team.game.map(({ slot, pick }, i) => (
            <li key={`${slot}-${i}`}>
              <Link to={pick ? `/scores/${pick.year}/${pick.week}/${pick.matchupId}` : '#'} className={`flex items-center gap-3 px-4 py-2 text-sm ${pick ? 'hover:bg-surface-2' : 'pointer-events-none text-muted'}`}>
                <span className="num w-10 shrink-0 text-xs font-bold" style={{ color: pick ? posColor(pick.position) : 'var(--muted)' }}>{slot}</span>
                {pick ? (
                  <>
                    <Headshot players={players} id={pick.playerId} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{playerName(players, pick.playerId)}</span>
                      <span className="num block text-xs text-muted">{pick.year} · Week {pick.week}{pick.tag ? ` · ${fmtTag(pick.tag)}` : ''}{pick.started ? '' : ' · on the bench'}</span>
                    </span>
                    <span className="num font-semibold">{fmtPts(pick.points)}</span>
                  </>
                ) : <span className="text-xs">—</span>}
              </Link>
            </li>
          ))}
      </ul>
    </section>
  );
}
