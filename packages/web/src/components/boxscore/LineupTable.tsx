import type { GameSide, PlayerDirectory, PlayerId, PlayerLine } from '@fantasy-dash/core';
import { fmtPts } from '../../lib/format';
import { gameLabel, type PlayerGame } from '../../lib/live/gameState';
import { playerName, playerPos, playerTeam, statLine } from '../../lib/players';
import { PlayerLink } from '../NameLink';
import Headshot from '../Headshot';
import FieldBar from './FieldBar';
import PosPill from '../PosPill';

interface Props {
  sides: [GameSide, GameSide]; slots: string[]; players: PlayerDirectory; seasonTeams: Record<PlayerId, string>;
  /** each player's NFL game state: the live week, or a past week's final scores */
  gameOf?: (id: PlayerId) => PlayerGame;
  /** the week is over, so every projection can be judged */
  played?: boolean;
}

/** points against projection: "+5.5" green, "−4.4" red */
function Verdict({ points, projected }: { points: number; projected: number }) {
  const d = Math.round((points - projected) * 10) / 10;
  if (d === 0) return <span className="text-muted">even</span>;
  return <span className={d > 0 ? 'text-win' : 'text-loss'}>{d > 0 ? `+${d.toFixed(1)}` : `−${Math.abs(d).toFixed(1)}`}</span>;
}

function PlayerCell({ line, players, seasonTeams, align, showPos = false, gameOf, played }: {
  line: PlayerLine | null; players: PlayerDirectory; seasonTeams: Record<PlayerId, string>; align: 'left' | 'right'; showPos?: boolean;
  gameOf?: (id: PlayerId) => PlayerGame;
  played: boolean;
}) {
  if (!line) return <div className={`font-display text-sm uppercase tracking-wide text-muted ${align === 'right' ? 'sm:text-right' : ''}`}>Empty</div>;
  const pos = playerPos(players, line.playerId);
  const game = gameOf?.(line.playerId);
  const on = game?.kind === 'live';
  // a player's projection is judged once his game is over: his NFL game final, or the whole week played
  const done = game ? game.kind === 'final' || game.kind === 'bye' : played;
  const right = align === 'right';
  return (
    // a player whose game is on is lit up, with the ball's spot in that game
    <div data-live={on ? 'true' : undefined} className={`flex min-w-0 items-center gap-3 ${right ? 'sm:flex-row-reverse sm:text-right' : ''} ${on ? '-mx-2 rounded-lg bg-accent/[0.07] px-2 py-1.5 ring-1 ring-accent/35' : ''}`}>
      <Headshot players={players} id={line.playerId} size={40} />
      {showPos && <PosPill pos={pos} />}
      <div className="min-w-0 flex-1">
        <div className="truncate leading-tight">
          <PlayerLink id={line.playerId} className="font-display text-[17px] font-bold uppercase tracking-wide">{playerName(players, line.playerId)}</PlayerLink>{' '}
          <span className="text-xs text-muted">{playerTeam(players, line.playerId, seasonTeams)}</span>
        </div>
        {game?.kind === 'live' && game.field && <FieldBar field={game.field} />}
        {game?.kind === 'final' && game.result && (
          <div data-testid="nfl-result" className={`font-display text-[13px] font-semibold uppercase tracking-wide ${game.result.startsWith('W') ? 'text-win' : game.result.startsWith('L') ? 'text-loss' : 'text-muted'}`}>{game.result}</div>
        )}
        <div className="truncate text-xs text-muted">
          {(() => {
            const stats = statLine(pos, line.stats);
            // a finished game's result line above already says it's over
            const label = game && !(game.kind === 'final' && game.result) ? gameLabel(game) : null;
            if (!label) return stats || '-';
            // before a player has a stat, his game state stands alone
            return <>{stats && <>{stats} · </>}<span data-testid="game-state" className={on ? 'font-semibold text-accent' : ''}>{label}</span></>;
          })()}
        </div>
      </div>
      <div className={`flex shrink-0 flex-col leading-none ${right ? 'items-start sm:items-start' : 'items-end'}`}>
        <span className="font-display text-[26px] font-semibold tabular-nums">{fmtPts(line.points)}</span>
        {line.projected !== null && (
          <span data-testid="player-proj" title="Projected" className="mt-1 whitespace-nowrap font-display text-sm tabular-nums text-muted">
            {line.projected.toFixed(1)}{done && <> · <Verdict points={line.points} projected={line.projected} /></>}
          </span>
        )}
      </div>
    </div>
  );
}

export default function LineupTable({ sides, slots, players, seasonTeams, gameOf, played = false }: Props) {
  const [a, b] = sides;
  return (
    <div className="card overflow-hidden">
      <div className="divide-y divide-line">
        {slots.map((slot, i) => (
          <div key={`${slot}-${i}`} className="grid grid-cols-[3rem_1fr] sm:grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2 px-5 py-2.5">
            <div className="min-w-0 col-start-2 sm:col-auto">
              <PlayerCell seasonTeams={seasonTeams} gameOf={gameOf} played={played} line={a.starters[i]?.player ?? null} players={players} align="left" />
            </div>
            <span className="order-first row-span-2 flex self-center sm:order-none sm:row-span-1 sm:w-14 sm:justify-center"><PosPill pos={slot} /></span>
            <div className="min-w-0 col-start-2 sm:col-auto border-t border-line pt-2 sm:border-0 sm:pt-0">
              <PlayerCell seasonTeams={seasonTeams} gameOf={gameOf} played={played} line={b.starters[i]?.player ?? null} players={players} align="right" />
            </div>
          </div>
        ))}
      </div>
      <details className="border-t border-line">
        <summary className="section-label cursor-pointer px-5 py-2.5 hover:text-ink">Bench</summary>
        <div className="divide-y divide-line border-t border-line">
          {Array.from({ length: Math.max(a.bench.length, b.bench.length) }, (_, i) => (
            <div key={i} className="grid grid-cols-[3rem_1fr] sm:grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2 px-5 py-2.5" data-testid="bench-row">
              <div className="min-w-0 col-start-2 sm:col-auto">
                {a.bench[i] ? <PlayerCell seasonTeams={seasonTeams} gameOf={gameOf} played={played} line={a.bench[i]} players={players} align="left" showPos /> : <div />}
              </div>
              <span className="order-first row-span-2 flex self-center sm:order-none sm:row-span-1 sm:w-14 sm:justify-center"><PosPill pos="BN" /></span>
              <div className="min-w-0 col-start-2 sm:col-auto border-t border-line pt-2 sm:border-0 sm:pt-0">
                {b.bench[i] ? <PlayerCell seasonTeams={seasonTeams} gameOf={gameOf} played={played} line={b.bench[i]} players={players} align="right" showPos /> : <div />}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
