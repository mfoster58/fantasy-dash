import { Fragment, type CSSProperties } from 'react';
import type { PlayerDirectory, Week } from '@fantasy-dash/core';
import Headshot from './Headshot';
import { PlayerLink } from './NameLink';
import { players as directory } from '../data/load';
import { crawlGroups } from '../lib/home/results';
import { homeWeek } from '../lib/home/pick';
import { useLive, useLiveStats } from '../lib/live/LiveProvider';
import { weekStatus } from '../lib/live/weekStatus';
import { playerName, playerTeam, posColor } from '../lib/players';

/** seconds each performer spends crossing, so a longer run doesn't race */
const PER_ITEM = 4.5;

/**
 * A slim crawl fixed to the bottom of a laptop screen: each position's ten best starters of the week by fantasy points,
 * QB, RB, WR then TE, each under its position's name, running right to left on a loop. Two copies of the run sit end to end and the track slides
 * by one copy's width, so the loop has no seam; hovering holds it still, and with reduced motion it stays put and scrolls by hand.
 */
export function PerformerCrawl({ week, players, live }: { week: Week; players: PlayerDirectory; live: boolean }) {
  const groups = crawlGroups(week, players, 10)
    .map((g) => ({ ...g, list: g.list.filter((p) => p.points > 0) }))
    .filter((g) => g.list.length > 0);
  if (!groups.length) return null;
  const count = groups.reduce((n, g) => n + g.list.length, 0);
  const run = (copy: boolean) => (
    <ul data-testid="crawl-run" aria-hidden={copy ? 'true' : undefined} className="flex shrink-0 items-stretch">
      {groups.map((g) => (
        <Fragment key={g.pos}>
          {/* each position opens with its name in its own colour */}
          <li data-testid="crawl-pos" className="flex items-center px-4 font-display text-sm font-bold uppercase tracking-[0.14em]" style={{ color: posColor(g.pos) }}>{g.pos}</li>
          {g.list.map((p, i) => (
            <li key={p.playerId} data-testid="crawl-item" className="flex items-center gap-2 whitespace-nowrap border-r border-line/70 pl-1 pr-4 text-[13px] last-of-type:border-r-0">
              <span data-testid="crawl-rank" className={`num text-xs ${i === 0 ? 'text-gold' : 'text-muted'}`}>{i + 1}</span>
              <Headshot players={players} id={p.playerId} size={22} eager />
              <PlayerLink id={p.playerId} tabIndex={copy ? -1 : undefined} className="font-semibold">{playerName(players, p.playerId)}</PlayerLink>
              <span className="text-xs text-muted">{playerTeam(players, p.playerId)}</span>
              <b className={`num ${i === 0 ? 'text-gold' : ''}`}>{p.points.toFixed(1)}</b>
            </li>
          ))}
        </Fragment>
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
          style={{ '--crawl': `${count * PER_ITEM}s` } as CSSProperties}
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
  return <PerformerCrawl week={week} players={directory} live={!!st?.started} />;
}
