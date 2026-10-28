import { useRef, useState } from 'react';
import { Link } from 'react-router';
import type { Game, GameSide, Manager, Season } from '@fantasy-dash/core';
import Avatar from './Avatar';
import LiveDot from './LiveDot';
import { fmtPts, fmtRecord, fmtTag } from '../lib/format';
import type { GameOutlook } from '../lib/live/outlook';
import { tickerWeek } from '../lib/live/overlay';
import { useLive } from '../lib/live/LiveProvider';
import { weekStatus } from '../lib/live/weekStatus';

const nameOf = (s: GameSide, m?: Manager) => m?.teamName ?? m?.displayName ?? s.userId;

type Status = 'upcoming' | 'live' | 'final';
const STATUS: Record<Status, { label: string; tone: string }> = {
  live: { label: 'Live', tone: 'text-loss' },
  final: { label: 'Final', tone: 'text-ink' },
  upcoming: { label: 'Projected', tone: 'text-muted' },
};

function Card({ game, season, outlook, played }: { game: Game; season: Season; outlook: GameOutlook | null; played: boolean }) {
  const status: Status = outlook?.status ?? (played ? 'final' : 'upcoming');
  const [a, b] = game.sides;
  const scored = status !== 'upcoming';
  const lead = scored && a.points !== b.points ? (a.points > b.points ? a.userId : b.userId) : null;
  const row = (s: GameSide) => {
    const m = season.managers[s.userId];
    const leads = lead === s.userId;
    return (
      <div className="flex items-center gap-2.5">
        <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={28} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className={`truncate text-sm ${leads ? 'font-semibold text-ink' : 'text-ink/85'}`}>{nameOf(s, m)}</div>
          <div className="num text-[11px] text-muted">{fmtRecord(s.recordBefore)}</div>
        </div>
        <span className={`num shrink-0 text-base ${!scored ? 'text-muted' : leads ? 'font-semibold text-ink' : 'text-ink/85'}`}>{fmtPts(scored ? s.points : s.projected)}</span>
      </div>
    );
  };
  return (
    <Link
      to={`/scores/${season.year}/${game.week}/${game.matchupId}`}
      aria-label={`${nameOf(a, season.managers[a.userId])} vs ${nameOf(b, season.managers[b.userId])}`}
      className="flex min-w-56 shrink-0 grow basis-56 snap-start flex-col gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 transition-colors hover:border-accent"
    >
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider">
        <span className="truncate text-accent">{game.tag ? fmtTag(game.tag) : null}</span>
        <span className={`flex shrink-0 items-center gap-1 ${STATUS[status].tone}`}>
          {status === 'live' && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-loss" />}
          {STATUS[status].label}
        </span>
      </div>
      {row(a)}
      {row(b)}
    </Link>
  );
}

const arrow = 'flex h-10 w-10 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full border border-line text-lg leading-none text-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-30 disabled:hover:border-line disabled:hover:text-muted';

export default function ScoreTicker() {
  const live = useLive();
  const strip = useRef<HTMLDivElement>(null);
  // a week stepped to with the arrows; null follows the current week
  const [picked, setPicked] = useState<number | null>(null);
  const season = live.season;
  const current = season ? tickerWeek(season, live.week) : null;
  if (!season || !current) return null;
  const weeks = season.weeks.filter((w) => w.games.length).map((w) => w.week);
  const shown = picked !== null && weeks.includes(picked) ? picked : current.week;
  const i = weeks.indexOf(shown);
  const { week, isLive, outlookOf } = weekStatus(season, season.weeks[shown - 1], live);
  const step = (d: 1 | -1) => {
    const n = weeks[i + d];
    if (n === undefined) return;
    setPicked(n === current.week ? null : n);
    strip.current?.scrollTo?.({ left: 0 });
  };
  return (
    <section aria-label="Scores" className="border-b border-line bg-surface-2/60">
      <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-10">
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" aria-label="Previous week" disabled={i <= 0} onClick={() => step(-1)} className={arrow}>‹</button>
          <div className="flex w-16 flex-col items-center leading-tight">
            <span className="num text-[11px] text-muted">{season.year}</span>
            <span className="whitespace-nowrap text-sm font-bold uppercase tracking-wide">Week {week.week}</span>
            <LiveDot on={isLive && live.polling} />
          </div>
          <button type="button" aria-label="Next week" disabled={i >= weeks.length - 1} onClick={() => step(1)} className={arrow}>›</button>
        </div>
        <div ref={strip} className="flex min-w-0 flex-1 snap-x gap-2.5 overflow-x-auto [scrollbar-width:none]">
          {week.games.map((g) => <Card key={g.id} game={g} season={season} outlook={outlookOf(g)} played={week.played} />)}
        </div>
      </div>
    </section>
  );
}
