import { useRef } from 'react';
import { Link } from 'react-router';
import type { Game, GameSide, Manager, Season, Week } from '@fantasy-dash/core';
import Avatar from './Avatar';
import LiveDot from './LiveDot';
import { players } from '../data/load';
import { fmtPts, fmtRecord } from '../lib/format';
import { playerGames } from '../lib/live/gameState';
import { gameOutlook, type GameOutlook } from '../lib/live/outlook';
import { liveWeek, tickerWeek } from '../lib/live/overlay';
import { useLive, type LiveData } from '../lib/live/LiveProvider';
import { playerTeam } from '../lib/players';

/** A synced week as it stands now: live points and outlooks when it's the live week, the synced week otherwise. */
export function weekStatus(season: Season, wk: Week, live: LiveData): { week: Week; isLive: boolean; outlookOf: (g: Game) => GameOutlook | null } {
  const isLive = live.season?.year === season.year && live.week === wk.week && live.matchups !== null;
  if (!isLive) return { week: wk, isLive, outlookOf: () => null };
  const week = liveWeek(wk, season.managers, live.matchups!, live.stats);
  const gameOf = playerGames((id) => playerTeam(players, id, season.playerTeams), live.games);
  return { week, isLive, outlookOf: (g) => gameOutlook(g, gameOf) };
}

const nameOf = (s: GameSide, m?: Manager) => m?.teamName ?? m?.displayName ?? s.userId;

function Card({ game, season, outlook, played }: { game: Game; season: Season; outlook: GameOutlook | null; played: boolean }) {
  const status = outlook?.status ?? (played ? 'final' : 'upcoming');
  const [a, b] = game.sides;
  const scored = status !== 'upcoming';
  const lead = scored && a.points !== b.points ? (a.points > b.points ? a.userId : b.userId) : null;
  const row = (s: GameSide) => {
    const m = season.managers[s.userId];
    return (
      <div className="flex items-center gap-2">
        <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={20} />
        <span className={`min-w-0 flex-1 truncate ${lead === s.userId ? 'font-semibold text-ink' : ''}`}>{nameOf(s, m)}</span>
        <span className="num text-[11px] text-muted">{fmtRecord(s.recordBefore)}</span>
        <span className={`num w-12 text-right ${!scored ? 'text-muted' : lead === s.userId ? 'font-semibold text-ink' : ''}`}>{fmtPts(scored ? s.points : s.projected)}</span>
      </div>
    );
  };
  return (
    <Link
      to={`/scores/${season.year}/${game.week}/${game.matchupId}`}
      aria-label={`${nameOf(a, season.managers[a.userId])} vs ${nameOf(b, season.managers[b.userId])}`}
      className="block w-64 shrink-0 snap-start space-y-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted transition-colors hover:border-accent"
    >
      {row(a)}
      {row(b)}
      {status !== 'live' && <div className="section-label text-right text-[10px]">{status === 'final' ? 'FINAL' : 'proj'}</div>}
    </Link>
  );
}

export default function ScoreTicker() {
  const live = useLive();
  const strip = useRef<HTMLDivElement>(null);
  const season = live.season;
  const synced = season ? tickerWeek(season, live.week) : null;
  if (!season || !synced) return null;
  const { week, isLive, outlookOf } = weekStatus(season, synced, live);
  const scroll = (dir: 1 | -1) => strip.current?.scrollBy({ left: dir * 480, behavior: 'smooth' });
  return (
    <section aria-label="Scores" className="border-b border-line bg-surface-2/60">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-2 sm:px-6 lg:px-10">
        <div className="flex shrink-0 flex-col gap-0.5">
          <span className="num whitespace-nowrap text-xs font-semibold">{season.year} · Week {week.week}</span>
          <LiveDot on={isLive && live.polling} />
        </div>
        <button type="button" aria-label="Scroll scores left" onClick={() => scroll(-1)} className="hidden shrink-0 rounded px-1 text-muted hover:text-ink md:block">‹</button>
        <div ref={strip} className="flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto [scrollbar-width:none]">
          {week.games.map((g) => <Card key={g.id} game={g} season={season} outlook={outlookOf(g)} played={week.played} />)}
        </div>
        <button type="button" aria-label="Scroll scores right" onClick={() => scroll(1)} className="hidden shrink-0 rounded px-1 text-muted hover:text-ink md:block">›</button>
      </div>
    </section>
  );
}
