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

type Outcome = 'won' | 'lost' | 'even';

const teamName = (side: GameSide, m?: Manager) => m?.teamName ?? m?.displayName ?? side.userId;

export default function ScoreCard({ game, played, managers, players, to }: Props) {
  const outcome = (side: GameSide): Outcome =>
    !played || game.winner === null ? 'even' : game.winner === side.userId ? 'won' : 'lost';
  return (
    <Link to={to} className="card block p-4 transition-colors hover:border-accent sm:p-5">
      <Header game={game} played={played} />
      <div className="mt-3 space-y-3">
        {game.sides.map((s) => (
          <TeamRow key={s.userId} side={s} manager={managers[s.userId]} played={played} outcome={outcome(s)} />
        ))}
      </div>
      {played && (
        <div className="mt-4 border-t border-line pt-3">
          <h3 className="section-label mb-2.5">Top performers</h3>
          <div className="grid gap-y-4 sm:grid-cols-2 sm:gap-x-6">
            {game.sides.map((s) => (
              <Performers key={s.userId} side={s} name={teamName(s, managers[s.userId])} players={players} />
            ))}
          </div>
        </div>
      )}
    </Link>
  );
}

function Header({ game, played }: { game: Game; played: boolean }) {
  const status = played ? 'Final' : 'Upcoming';
  const detail = !played ? 'Projected' : game.winner === null ? 'Tie' : `Won by ${fmtPts(game.margin)}`;
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className={game.tag ? 'font-semibold text-accent' : 'text-muted'}>
        {game.tag ? fmtTag(game.tag) : `Week ${game.week}`}
      </span>
      <span className="flex items-baseline gap-2">
        <span className="section-label text-ink">{status}</span>
        <span className="num text-muted">{detail}</span>
      </span>
    </div>
  );
}

function TeamRow({ side, manager, played, outcome }: {
  side: GameSide; manager?: Manager; played: boolean; outcome: Outcome;
}) {
  const scoreTone = outcome === 'won' ? 'font-semibold text-ink' : outcome === 'lost' ? 'text-muted' : 'text-ink';
  return (
    <div className="flex items-center gap-3">
      <Avatar avatar={manager?.avatar ?? null} name={manager?.displayName ?? '?'} size={36} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold leading-tight">{teamName(side, manager)}</div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {manager?.displayName} · <span className="num">{fmtRecord(side.recordBefore)}</span>
        </div>
      </div>
      {played && (
        <span
          className="num shrink-0 rounded bg-surface-2 px-1.5 py-px text-[11px] text-muted"
          title="Efficiency: points divided by the best possible lineup"
        >
          {fmtPct(side.efficiency, 0)}
        </span>
      )}
      {played ? (
        <span className={`num min-w-[5.5rem] shrink-0 text-right text-2xl leading-none ${scoreTone}`}>{fmtPts(side.points)}</span>
      ) : (
        <span className="num shrink-0 text-right text-2xl leading-none text-muted">
          {fmtPts(side.projected)}
          <span className="ml-1 text-xs"> proj</span>
        </span>
      )}
    </div>
  );
}

function Performers({ side, name, players }: { side: GameSide; name: string; players: PlayerDirectory }) {
  const top = topPerformersBySide(side);
  return (
    <div className="min-w-0">
      <div className="mb-1.5 truncate text-xs text-muted">{name}</div>
      <ul className="space-y-2">
        {top.map((t) => (
          <li key={t.playerId} className="flex items-center gap-2.5">
            <Headshot players={players} id={t.playerId} size={28} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-medium leading-tight">{playerName(players, t.playerId)}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                <PosPill pos={playerPos(players, t.playerId)} />
                <span>{playerTeam(players, t.playerId) || 'FA'}</span>
              </div>
            </div>
            <span className="num shrink-0 text-sm">{fmtPts(t.points)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
