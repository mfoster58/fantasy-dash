import type { CSSProperties } from 'react';
import type { Manager, PlayerDirectory, UserId, Week } from '@fantasy-dash/core';
import Headshot from './Headshot';
import { PlayerLink } from './NameLink';
import PosPill from './PosPill';
import { players as directory } from '../data/load';
import { crawlPerformers } from '../lib/home/results';
import { homeWeek } from '../lib/home/pick';
import { useLive, useLiveStats } from '../lib/live/LiveProvider';
import { weekStatus } from '../lib/live/weekStatus';
import { playerName, playerPos, playerTeam } from '../lib/players';

/** seconds each performer spends crossing, so a longer run doesn't race */
const PER_ITEM = 4.5;

/**
 * A slim crawl fixed to the bottom of a laptop screen: the week's best starters by fantasy points, kickers and
 * defenses left out, running right to left on a loop. Two copies of the run sit end to end and the track slides
 * by one copy's width, so the loop has no seam; hovering holds it still, and with reduced motion it stays put and scrolls by hand.
 */
export function PerformerCrawl({ week, managers, players, live }: { week: Week; managers: Record<UserId, Manager>; players: PlayerDirectory; live: boolean }) {
  const top = crawlPerformers(week, players, 20).filter((p) => p.points > 0);
  if (!top.length) return null;
  const run = (copy: boolean) => (
    <ul data-testid="crawl-run" aria-hidden={copy ? 'true' : undefined} className="flex shrink-0 items-stretch">
      {top.map((p, i) => (
        <li key={p.playerId} data-testid="crawl-item" className="flex items-center gap-2 whitespace-nowrap border-r border-line/70 px-4 text-[13px]">
          <span className={`num text-xs ${i === 0 ? 'text-gold' : 'text-muted'}`}>{i + 1}</span>
          <Headshot players={players} id={p.playerId} size={22} />
          <PlayerLink id={p.playerId} tabIndex={copy ? -1 : undefined} className="font-semibold">{playerName(players, p.playerId)}</PlayerLink>
          <PosPill pos={playerPos(players, p.playerId)} />
          <span className="text-xs text-muted">{playerTeam(players, p.playerId)}</span>
          <b className={`num ${i === 0 ? 'text-gold' : ''}`}>{p.points.toFixed(1)}</b>
          <span className="text-xs text-muted">{managers[p.userId]?.displayName ?? p.userId}</span>
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label={`Week ${week.week} top performers`} className="fixed inset-x-0 bottom-0 z-30 hidden h-9 items-stretch border-t border-line bg-surface/95 backdrop-blur md:flex">
      {/* the label is cut on the banners' 11deg slant */}
      <div className="relative z-10 flex shrink-0 items-center gap-2 bg-accent pl-4 pr-7 font-display text-[13px] font-bold uppercase tracking-[0.14em] text-[var(--on-chip)] [clip-path:polygon(0_0,100%_0,calc(100%-7px)_100%,0_100%)]">
        {live && <span className="flex items-center gap-1.5"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--on-chip)]" />Live ·</span>}
        Week {week.week} · Top performers
      </div>
      <div className="-ml-2 min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_24px,#000_calc(100%-24px),transparent)] motion-reduce:overflow-x-auto">
        <div
          className="flex h-full w-max animate-[crawl_var(--crawl)_linear_infinite] hover:[animation-play-state:paused] motion-reduce:animate-none"
          style={{ '--crawl': `${top.length * PER_ITEM}s` } as CSSProperties}
        >
          {run(false)}
          {run(true)}
        </div>
      </div>
    </section>
  );
}

/** The crawl for the current week: live points once it kicks off, the last week played until then. */
export default function BottomCrawl() {
  const live = useLive();
  const season = live.season;
  const now = season ? homeWeek(season, live.week) : null;
  const st = season && now ? weekStatus(season, now, live) : null;
  useLiveStats(!!st?.started);
  if (!season) return null;
  const week = st?.started ? st.week : season.lastScoredWeek > 0 ? season.weeks[season.lastScoredWeek - 1] : null;
  if (!week) return null;
  return <PerformerCrawl week={week} managers={season.managers} players={directory} live={!!st?.started} />;
}
