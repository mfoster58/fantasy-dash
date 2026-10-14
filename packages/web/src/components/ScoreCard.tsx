import { Link } from 'react-router';
import type { Game, GameSide, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import Avatar from './Avatar';
import Headshot from './Headshot';
import PosPill from './PosPill';
import { fmtPct, fmtPts, fmtRecord, fmtTag } from '../lib/format';
import { topPerformersBySide } from '../lib/metrics';
import { playerName, playerPos, playerTeam } from '../lib/players';

interface Props {
  game: Game;
  played: boolean;
  managers: Record<UserId, Manager>;
  players: PlayerDirectory;
  to: string;
}

type Align = 'left' | 'right';

export default function ScoreCard({ game, played, managers, players, to }: Props) {
  const [a, b] = game.sides;
  const panel = (side: GameSide, align: Align) => (
    <TeamPanel
      side={side}
      manager={managers[side.userId]}
      players={players}
      played={played}
      outcome={!played || game.winner === null ? 'even' : game.winner === side.userId ? 'won' : 'lost'}
      align={align}
    />
  );
  return (
    <Link
      to={to}
      className="card block transition-colors hover:border-accent"
    >
      <div className="grid md:grid-cols-[1fr_auto_1fr]">
        {panel(a, 'left')}
        <Center game={game} played={played} />
        {panel(b, 'right')}
      </div>
    </Link>
  );
}

function Center({ game, played }: { game: Game; played: boolean }) {
  const status = played ? 'Final' : 'Upcoming';
  const detail = !played ? 'Projected' : game.winner === null ? 'Tie' : `Won by ${fmtPts(game.margin)}`;
  return (
    <div className="flex items-center gap-3 border-y border-line bg-surface-2/40 px-4 py-2 text-xs md:w-32 md:flex-col md:justify-center md:gap-1 md:border-x md:border-y-0 md:px-3 md:py-4 md:text-center">
      <span className={game.tag ? 'font-semibold text-accent' : 'text-muted'}>{game.tag ? fmtTag(game.tag) : `Week ${game.week}`}</span>
      <span className="section-label text-ink">{status}</span>
      <span className="num text-muted">{detail}</span>
    </div>
  );
}

function TeamPanel({ side, manager, players, played, outcome, align }: {
  side: GameSide; manager?: Manager; players: PlayerDirectory; played: boolean; outcome: 'won' | 'lost' | 'even'; align: Align;
}) {
  const r = align === 'right';
  const top = played ? topPerformersBySide(side) : [];
  const scoreTone = outcome === 'won' ? 'font-semibold text-ink' : outcome === 'lost' ? 'text-muted' : 'text-ink';
  return (
    <div className="min-w-0 p-4 md:p-5">
      <div className={`flex items-center gap-3 ${r ? 'md:flex-row-reverse md:text-right' : ''}`}>
        <Avatar avatar={manager?.avatar ?? null} name={manager?.displayName ?? '?'} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{manager?.teamName ?? manager?.displayName ?? side.userId}</div>
          <div className="truncate text-xs text-muted">
            {manager?.displayName} · <span className="num">{fmtRecord(side.recordBefore)}</span>
          </div>
        </div>
        <div className={`flex shrink-0 flex-col items-end gap-1 ${r ? 'md:items-start' : ''}`}>
          {played ? (
            <span className={`num text-[28px] leading-none ${scoreTone}`}>{fmtPts(side.points)}</span>
          ) : (
            <span className="num text-lg leading-none text-muted">{fmtPts(side.projected)} proj</span>
          )}
          {played && (
            <span
              className="num rounded bg-surface-2 px-1.5 py-px text-[11px] text-muted"
              title="Efficiency: points divided by the best possible lineup"
            >
              {fmtPct(side.efficiency, 0)}
            </span>
          )}
        </div>
      </div>
      {top.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <div className={`max-w-[420px] ${r ? 'md:ml-auto' : ''}`}>
          <h3 className={`section-label mb-2 ${r ? 'md:text-right' : ''}`}>Top performers</h3>
          <ul className="space-y-2">
            {top.map((t) => {
              const pos = playerPos(players, t.playerId);
              return (
                <li key={t.playerId} className={`flex items-center gap-2.5 ${r ? 'md:flex-row-reverse md:text-right' : ''}`}>
                  <Headshot players={players} id={t.playerId} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium leading-tight">{playerName(players, t.playerId)}</div>
                    <div className={`mt-0.5 flex items-center gap-1.5 text-xs text-muted ${r ? 'md:justify-end' : ''}`}>
                      <PosPill pos={pos} />
                      <span>{playerTeam(players, t.playerId) || 'FA'}</span>
                    </div>
                  </div>
                  <span className="num shrink-0 text-sm">{fmtPts(t.points)}</span>
                </li>
              );
            })}
          </ul>
          </div>
        </div>
      )}
    </div>
  );
}
