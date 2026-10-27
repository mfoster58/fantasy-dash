import type { Game, GameSide, Manager, PlayerDirectory, PlayerId, UserId } from '@fantasy-dash/core';
import Headshot from './Headshot';
import GameBanner, { type BannerStanding } from './home/GameBanner';
import PosPill from './PosPill';
import { fmtPct, fmtPts, fmtTag } from '../lib/format';
import { gameView } from '../lib/home/view';
import { topPerformersBySide } from '../lib/metrics';
import { playerName, playerPos, playerTeam } from '../lib/players';
import type { GameOutlook } from '../lib/live/outlook';

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
  /** the live outlook when this is the live week */
  live?: GameOutlook;
  /** each team's rank and streak entering the game */
  standing?: (userId: UserId) => BannerStanding | undefined;
  /** the smaller banner, for cards set two across */
  compact?: boolean;
}

type Align = 'left' | 'right';

const teamName = (side: GameSide, m?: Manager) => m?.teamName ?? m?.displayName ?? side.userId;

/** 90%+ is a well-set lineup, 75-90% left points on the bench, below 75% a lot. */
const effColor = (e: number) => {
  const pct = Math.round(e * 100);
  const tone = pct >= 90 ? 'var(--win)' : pct >= 75 ? 'var(--warn)' : 'var(--loss)';
  return `color-mix(in srgb, ${tone} 65%, transparent)`;
};

export default function ScoreCard({ game, played, managers, players, seasonTeams, to, year, live, standing, compact = false }: Props) {
  const [a, b] = game.sides;
  const view = gameView(game, live ?? null, played);
  const started = view.status !== 'upcoming';
  return (
    <div className="card min-w-0 overflow-hidden transition-colors hover:border-accent">
      <GameBanner
        bare compact={compact} game={game} season={{ managers, year }} view={view} decimals={2} standing={standing}
        title={game.tag ? fmtTag(game.tag) : null} to={to}
        linkLabel={`${teamName(a, managers[a.userId])} vs ${teamName(b, managers[b.userId])} box score`}
      />
      {played && !live && (
        <div className="grid grid-cols-2 gap-x-8 border-t border-line px-4 pt-3 sm:px-5" title="Points scored as a share of the best possible lineup">
          <EffBar value={a.efficiency} align="left" />
          <EffBar value={b.efficiency} align="right" />
        </div>
      )}
      {started && (
        <div className={`px-4 pb-4 pt-3 sm:px-5 ${played && !live ? '' : 'border-t border-line'}`}>
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
