import type { Game, GameSide, Manager, PlayerDirectory, PlayerId, UserId } from '@fantasy-dash/core';
import Avatar from './Avatar';
import Headshot from './Headshot';
import { CoverLink, ManagerLink, TeamLink } from './NameLink';
import PosPill from './PosPill';
import { fmtPct, fmtPts, fmtRecord, fmtTag } from '../lib/format';
import { topPerformersBySide } from '../lib/metrics';
import { playerName, playerPos, playerTeam } from '../lib/players';

interface Props {
  game: Game;
  played: boolean;
  managers: Record<UserId, Manager>;
  players: PlayerDirectory;
  /** that season's player -> team map */
  seasonTeams: Record<PlayerId, string>;
  to: string;
  /** the season the game belongs to, for the team links */
  year: number;
}

type Outcome = 'won' | 'lost' | 'even';
type Align = 'left' | 'right';

const teamName = (side: GameSide, m?: Manager) => m?.teamName ?? m?.displayName ?? side.userId;

/** 90%+ is a well-set lineup, 75-90% left points on the bench, below 75% a lot. */
const effColor = (e: number) => {
  const pct = Math.round(e * 100);
  const tone = pct >= 90 ? 'var(--win)' : pct >= 75 ? 'var(--warn)' : 'var(--loss)';
  return `color-mix(in srgb, ${tone} 65%, transparent)`;
};

export default function ScoreCard({ game, played, managers, players, seasonTeams, to, year }: Props) {
  const outcome = (side: GameSide): Outcome =>
    !played || game.winner === null ? 'even' : game.winner === side.userId ? 'won' : 'lost';
  const [a, b] = game.sides;
  return (
    // the whole card opens the box score through a cover link, so the team and manager names can be links of their own
    <div className="card relative p-4 transition-colors hover:border-accent sm:p-5">
      <CoverLink to={to} label="Box score" className="rounded-xl" />
      <Header game={game} played={played} />
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 sm:gap-x-4">
        <Team side={a} manager={managers[a.userId]} played={played} outcome={outcome(a)} align="left" year={year} />
        <span className="section-label self-center px-0.5 text-[12px] lowercase tracking-[0.12em]" style={{ fontVariant: 'small-caps' }}>vs</span>
        <Team side={b} manager={managers[b.userId]} played={played} outcome={outcome(b)} align="right" year={year} />
        {played && (
          <div
            className="col-span-3 mt-4 grid grid-cols-subgrid"
            title="Points scored as a share of the best possible lineup"
          >
            <EffBar value={a.efficiency} align="left" />
            <span aria-hidden />
            <EffBar value={b.efficiency} align="right" />
          </div>
        )}
      </div>
      {played && (
        <div className="mt-4 border-t border-line pt-3">
          <h3 className="section-label mb-2.5">Top performers</h3>
          <div className="grid gap-y-3 sm:grid-cols-2 sm:gap-x-8 [&>*+*]:max-sm:border-t [&>*+*]:max-sm:border-line [&>*+*]:max-sm:pt-3">
            {game.sides.map((s) => (
              <Performers key={s.userId} side={s} players={players} seasonTeams={seasonTeams} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Header({ game, played }: { game: Game; played: boolean }) {
  const status = !played ? 'Upcoming' : game.winner === null ? 'Tie' : 'Final';
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="font-semibold text-accent">{game.tag ? fmtTag(game.tag) : null}</span>
      <span className="section-label text-ink">{status}</span>
    </div>
  );
}

function Team({ side, manager, played, outcome, align, year }: {
  side: GameSide; manager?: Manager; played: boolean; outcome: Outcome; align: Align; year: number;
}) {
  const right = align === 'right';
  const scoreTone = outcome === 'won' ? 'font-semibold text-ink' : outcome === 'lost' ? 'text-muted' : 'text-ink';
  return (
    <div
      className={`flex min-w-0 flex-col items-center gap-2 text-center sm:items-center sm:gap-3 ${
        right ? 'sm:flex-row-reverse sm:text-right' : 'sm:flex-row sm:text-left'
      }`}
    >
      <Avatar avatar={manager?.avatar ?? null} name={manager?.displayName ?? '?'} size={40} />
      <div className="w-full min-w-0 sm:w-auto sm:flex-1">
        <TeamLink userId={side.userId} year={year} className="relative z-10 line-clamp-2 font-semibold leading-tight" title={teamName(side, manager)}>{teamName(side, manager)}</TeamLink>
        <div className="mt-0.5 truncate text-xs text-muted">
          {manager?.displayName && <ManagerLink userId={side.userId} className="relative z-10">{manager.displayName}</ManagerLink>} · <span className="num">{fmtRecord(side.recordBefore)}</span>
        </div>
      </div>
      {played ? (
        <span className={`num shrink-0 text-[28px] leading-none ${scoreTone}`}>{fmtPts(side.points)}</span>
      ) : (
        <span className="num flex shrink-0 flex-col items-center text-[28px] leading-none text-muted">
          {fmtPts(side.projected)}
          <span className="section-label mt-1 text-[10px] leading-none">proj</span>
        </span>
      )}
    </div>
  );
}

function EffBar({ value, align }: { value: number; align: Align }) {
  const right = align === 'right';
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="min-w-0">
      <div className={`mb-1.5 flex items-baseline justify-between gap-2 ${right ? 'flex-row-reverse' : ''}`}>
        <span className="section-label">Efficiency</span>
        <span className="num text-xs text-ink">{fmtPct(value, 0)}</span>
      </div>
      <div className={`flex h-1.5 overflow-hidden rounded-full bg-surface-2 ${right ? 'justify-end' : ''}`}>
        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: effColor(value) }} />
      </div>
    </div>
  );
}

function Performers({ side, players, seasonTeams }: { side: GameSide; players: PlayerDirectory; seasonTeams: Record<PlayerId, string> }) {
  const top = topPerformersBySide(side);
  return (
    <ul className="min-w-0 space-y-2">
      {top.map((t) => (
        <li key={t.playerId} className="grid grid-cols-[28px_minmax(0,1fr)_44px_32px_auto] items-center gap-x-2.5">
          <Headshot players={players} id={t.playerId} size={28} />
          <span className="truncate text-[13px] font-medium">{playerName(players, t.playerId)}</span>
          <span className="flex justify-center"><PosPill pos={playerPos(players, t.playerId)} /></span>
          <span className="text-xs text-muted">{playerTeam(players, t.playerId, seasonTeams) || 'FA'}</span>
          <span className="num pl-1 text-right text-sm">{fmtPts(t.points)}</span>
        </li>
      ))}
    </ul>
  );
}
