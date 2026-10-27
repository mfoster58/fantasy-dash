import type { GameSide, PlayerDirectory, PlayerId, PlayerLine } from '@fantasy-dash/core';
import { fmtPts } from '../../lib/format';
import { gameLabel, type PlayerGame, type Versus } from '../../lib/live/gameState';
import type { Difficulty } from '../../lib/matchups/difficulty';
import { playerName, playerPos, playerTeam, statLine } from '../../lib/players';
import { PlayerLink } from '../NameLink';
import Headshot from '../Headshot';
import FieldBar from './FieldBar';
import PosPill from '../PosPill';

/** how hard a defense is for a position, from the season's points allowed */
type Matchup = (team: string, pos: string) => Difficulty | null;

interface Props {
  sides: [GameSide, GameSide]; slots: string[]; players: PlayerDirectory; seasonTeams: Record<PlayerId, string>;
  /** each player's NFL game state: the live week, or a past week's final scores */
  gameOf?: (id: PlayerId) => PlayerGame;
  matchup?: Matchup;
}

const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/** the opponent, green when his defense gives up the most to this position, red when it gives up the least */
function Opponent({ vs, pos, matchup }: { vs: Versus; pos: string; matchup?: Matchup }) {
  const d = matchup?.(vs.opp, pos);
  const title = d
    ? `${vs.opp} allow the ${d.rank <= d.of / 2 ? `${ord(d.rank)} most` : `${ord(d.of - d.rank + 1)} fewest`} points per game to ${pos}s (${d.perGame})`
    : undefined;
  return <span title={title} className={d?.tone === 'easy' ? 'text-win' : d?.tone === 'hard' ? 'text-loss' : ''}>{vs.opp}</span>;
}

/** "W 38-21 @ PHI" for a finished game, "Sun 1:00 PM · vs NYG" for one to come */
function NflLine({ game, pos, matchup }: { game: PlayerGame | undefined; pos: string; matchup?: Matchup }) {
  const line = 'font-display text-[13px] font-semibold uppercase tracking-wide text-ink/85';
  if (game?.kind === 'final' && game.result && game.vs) {
    const { outcome, us, them } = game.result;
    return (
      <div data-testid="nfl-result" className={line}>
        <span className={outcome === 'W' ? 'text-win' : outcome === 'L' ? 'text-loss' : 'text-muted'}>{outcome}</span> {us}-{them} {game.vs.home ? 'vs' : '@'} <Opponent vs={game.vs} pos={pos} matchup={matchup} />
      </div>
    );
  }
  if (game?.kind === 'upcoming' && game.vs) {
    return <div data-testid="nfl-preview" className={line}>{gameLabel(game)} · {game.vs.home ? 'vs' : '@'} <Opponent vs={game.vs} pos={pos} matchup={matchup} /></div>;
  }
  return null;
}

function PlayerCell({ line, players, seasonTeams, align, showPos = false, gameOf, matchup }: {
  line: PlayerLine | null; players: PlayerDirectory; seasonTeams: Record<PlayerId, string>; align: 'left' | 'right'; showPos?: boolean;
  gameOf?: (id: PlayerId) => PlayerGame;
  matchup?: Matchup;
}) {
  if (!line) return <div className={`font-display text-sm uppercase tracking-wide text-muted ${align === 'right' ? 'sm:text-right' : ''}`}>Empty</div>;
  const pos = playerPos(players, line.playerId);
  const game = gameOf?.(line.playerId);
  const on = game?.kind === 'live';
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
        <NflLine game={game} pos={pos} matchup={matchup} />
        <div className="truncate text-xs text-muted">
          {(() => {
            const stats = statLine(pos, line.stats);
            // the result or preview line above already says when and who
            const said = (game?.kind === 'final' && game.result && game.vs) || (game?.kind === 'upcoming' && game.vs);
            const label = game && !said ? gameLabel(game) : null;
            if (!label) return stats || '-';
            // before a player has a stat, his game state stands alone
            return <>{stats && <>{stats} · </>}<span data-testid="game-state" className={on ? 'font-semibold text-accent' : ''}>{label}</span></>;
          })()}
        </div>
      </div>
      <div className={`flex shrink-0 flex-col leading-none ${right ? 'items-start sm:items-start' : 'items-end'}`}>
        <span className="font-display text-[26px] font-semibold tabular-nums">{fmtPts(line.points)}</span>
        {line.projected !== null && (
          <span data-testid="player-proj" title="Projected" className="mt-1 whitespace-nowrap font-display text-base tabular-nums text-muted">
            {line.projected.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

export default function LineupTable({ sides, slots, players, seasonTeams, gameOf, matchup }: Props) {
  const [a, b] = sides;
  return (
    <div className="card overflow-hidden">
      <div className="divide-y divide-line">
        {slots.map((slot, i) => (
          <div key={`${slot}-${i}`} className="grid grid-cols-[3rem_1fr] sm:grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2 px-5 py-2.5">
            <div className="min-w-0 col-start-2 sm:col-auto">
              <PlayerCell seasonTeams={seasonTeams} gameOf={gameOf} matchup={matchup} line={a.starters[i]?.player ?? null} players={players} align="left" />
            </div>
            <span className="order-first row-span-2 flex self-center sm:order-none sm:row-span-1 sm:w-14 sm:justify-center"><PosPill pos={slot} /></span>
            <div className="min-w-0 col-start-2 sm:col-auto border-t border-line pt-2 sm:border-0 sm:pt-0">
              <PlayerCell seasonTeams={seasonTeams} gameOf={gameOf} matchup={matchup} line={b.starters[i]?.player ?? null} players={players} align="right" />
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
                {a.bench[i] ? <PlayerCell seasonTeams={seasonTeams} gameOf={gameOf} matchup={matchup} line={a.bench[i]} players={players} align="left" showPos /> : <div />}
              </div>
              <span className="order-first row-span-2 flex self-center sm:order-none sm:row-span-1 sm:w-14 sm:justify-center"><PosPill pos="BN" /></span>
              <div className="min-w-0 col-start-2 sm:col-auto border-t border-line pt-2 sm:border-0 sm:pt-0">
                {b.bench[i] ? <PlayerCell seasonTeams={seasonTeams} gameOf={gameOf} matchup={matchup} line={b.bench[i]} players={players} align="right" showPos /> : <div />}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
