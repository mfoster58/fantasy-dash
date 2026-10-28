import type { GameSide, PlayerDirectory, PlayerId, PlayerLine } from '@fantasy-dash/core';
import { fmtPts } from '../../lib/format';
import { gameLabel, type PlayerGame, type Versus } from '../../lib/live/gameState';
import type { Difficulty } from '../../lib/matchups/difficulty';
import { playerName, playerPos, playerTeam, shortName, statLine } from '../../lib/players';
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
  const line = 'truncate font-display text-xs font-semibold uppercase tracking-wide text-ink/85 sm:text-[13px]';
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
  if (!line) return <div className={`font-display text-sm uppercase tracking-wide text-muted ${align === 'right' ? 'text-right' : ''}`}>Empty</div>;
  const pos = playerPos(players, line.playerId);
  const game = gameOf?.(line.playerId);
  const on = game?.kind === 'live';
  const right = align === 'right';
  return (
    // a player whose game is on is lit up, with the ball's spot in that game; the right side mirrors the left, points toward the slot
    <div data-live={on ? 'true' : undefined} className={`flex min-w-0 items-start gap-2 sm:items-center sm:gap-3 ${right ? 'flex-row-reverse text-right' : ''} ${on ? '-mx-1.5 rounded-lg bg-accent/[0.07] px-1.5 py-1.5 ring-1 ring-accent/35 sm:-mx-2 sm:px-2' : ''}`}>
      <span className="hidden sm:contents"><Headshot players={players} id={line.playerId} size={40} /></span>
      {showPos && <span className="hidden sm:contents"><PosPill pos={pos} /></span>}
      <div className="min-w-0 flex-1">
        <div className="truncate leading-tight">
          {/* a phone row has room for "P. Mahomes"; the link keeps the full name for screen readers */}
          <PlayerLink id={line.playerId} aria-label={playerName(players, line.playerId)} className="font-display text-[15px] font-bold uppercase tracking-wide sm:text-[17px]">
            <span className="sm:hidden">{shortName(players, line.playerId)}</span>
            <span className="hidden sm:inline">{playerName(players, line.playerId)}</span>
          </PlayerLink>{' '}
          <span className="text-[11px] text-muted sm:text-xs">{showPos && <span className="sm:hidden">{pos} </span>}{playerTeam(players, line.playerId, seasonTeams)}</span>
        </div>
        {game?.kind === 'live' && game.field && <FieldBar field={game.field} />}
        <NflLine game={game} pos={pos} matchup={matchup} />
        <div className="line-clamp-2 text-[11px] leading-snug text-muted sm:line-clamp-none sm:truncate sm:text-xs sm:leading-normal">
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
      <div className={`flex shrink-0 flex-col leading-none ${right ? 'items-start' : 'items-end'}`}>
        <span className="font-display text-[21px] font-semibold tabular-nums sm:text-[26px]">{fmtPts(line.points)}</span>
        {line.projected !== null && (
          <span data-testid="player-proj" title="Projected" className="mt-1 whitespace-nowrap font-display text-sm tabular-nums text-muted sm:text-base">
            {line.projected.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  );
}

/** a slot's row, like every fantasy app's matchup screen: one manager's player | the slot | the other's */
const ROW = 'grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 px-3 py-2.5 sm:gap-x-3 sm:px-5';
const SLOT = 'flex justify-center sm:w-14 [&>.pos-pill]:min-w-[2.1rem]';

export default function LineupTable({ sides, slots, players, seasonTeams, gameOf, matchup }: Props) {
  const [a, b] = sides;
  return (
    <div className="card overflow-hidden">
      <div className="divide-y divide-line">
        {slots.map((slot, i) => (
          <div key={`${slot}-${i}`} data-testid="slot-row" className={ROW}>
            <div className="min-w-0">
              <PlayerCell seasonTeams={seasonTeams} gameOf={gameOf} matchup={matchup} line={a.starters[i]?.player ?? null} players={players} align="left" />
            </div>
            <span className={SLOT}><PosPill pos={slot} /></span>
            <div className="min-w-0">
              <PlayerCell seasonTeams={seasonTeams} gameOf={gameOf} matchup={matchup} line={b.starters[i]?.player ?? null} players={players} align="right" />
            </div>
          </div>
        ))}
      </div>
      <details className="border-t border-line">
        <summary className="section-label cursor-pointer px-3 py-3.5 hover:text-ink sm:px-5 sm:py-2.5">Bench</summary>
        <div className="divide-y divide-line border-t border-line">
          {Array.from({ length: Math.max(a.bench.length, b.bench.length) }, (_, i) => (
            <div key={i} className={ROW} data-testid="bench-row">
              <div className="min-w-0">
                {a.bench[i] ? <PlayerCell seasonTeams={seasonTeams} gameOf={gameOf} matchup={matchup} line={a.bench[i]} players={players} align="left" showPos /> : <div />}
              </div>
              <span className={SLOT}><PosPill pos="BN" /></span>
              <div className="min-w-0">
                {b.bench[i] ? <PlayerCell seasonTeams={seasonTeams} gameOf={gameOf} matchup={matchup} line={b.bench[i]} players={players} align="right" showPos /> : <div />}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
