import type { Game, GameSide, Season } from '@fantasy-dash/core';
import { avatarUrl } from '../Avatar';
import { CoverLink, TeamLink } from '../NameLink';
import { fmtRecord } from '../../lib/format';
import { hasRanks } from '../../lib/home/pick';
import type { GameView } from '../../lib/home/view';

const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
export const teamName = (season: Season, userId: string) => season.managers[userId]?.teamName ?? season.managers[userId]?.displayName ?? userId;

export function StateLabel({ status }: { status: GameView['status'] }) {
  if (status === 'live') return <span className="inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-[0.16em] text-loss"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-loss" />Live</span>;
  if (status === 'final') return <span className="font-display text-xs font-bold uppercase tracking-[0.16em] text-ink">Final</span>;
  return <span className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Projected</span>;
}
/** neutral until final; then the winner bright and bold, the loser dimmed */
export const scoreTone = (view: GameView, i: 0 | 1) => (view.winner === null ? 'text-ink/85' : view.winner === i ? 'font-bold text-ink' : 'text-muted');

/** a photo cut on a diagonal with a team-coloured stripe and a thinner gold one just inside it, both over the photo so it runs past the gold to the cut (the cut's 40px run over ~200px matches the stripes' 11deg) */
function Panel({ season, side, right }: { season: Season; side: GameSide; right?: boolean }) {
  const m = season.managers[side.userId];
  const cut = right ? 'polygon(0 0, 100% 0, 100% 100%, 40px 100%)' : 'polygon(0 0, 100% 0, calc(100% - 40px) 100%, 0 100%)';
  return (
    <div data-testid="banner-photo" className="pointer-events-none relative hidden w-52 shrink-0 sm:block lg:w-64" aria-hidden="true">
      <div className="absolute inset-0" style={{ clipPath: cut }}>
        {m?.avatar
          ? <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${avatarUrl(m.avatar)})` }} />
          : <div className={`absolute inset-0 flex items-center bg-surface-2 px-10 font-display text-4xl font-bold text-muted ${right ? 'justify-end' : ''}`}>{(m?.displayName ?? '?').slice(0, 2).toUpperCase()}</div>}
      </div>
      <div className={`absolute -inset-y-3 w-2 ${right ? 'left-[38px] skew-x-[11deg] bg-coral' : 'right-[38px] -skew-x-[11deg] bg-accent'}`} />
      <div className={`absolute -inset-y-3 w-[5px] bg-gold ${right ? 'left-[26px] skew-x-[11deg]' : 'right-[26px] -skew-x-[11deg]'}`} />
    </div>
  );
}

export default function GameBanner({ game, season, view }: { game: Game; season: Season; view: GameView }) {
  const [a, b] = game.sides;
  // standings are placeholders until a regular-season week is played: no rank or streak before then
  const row = (u: string) => (hasRanks(season) ? season.standings.find((r) => r.userId === u) : undefined);
  const team = (s: GameSide, right?: boolean) => {
    const m = season.managers[s.userId]; const r = row(s.userId);
    const streak = r && r.streak !== '-' ? r.streak : null;
    const bits = [<span key="rec">{fmtRecord(s.recordBefore)}</span>];
    if (r) bits.push(<span key="rank">{ord(r.rank)}</span>);
    if (streak) bits.push(<span key="strk" className={streak.startsWith('W') ? 'text-win' : streak.startsWith('L') ? 'text-loss' : ''}>{streak}</span>);
    return (
      <div className={`min-w-0 ${right ? 'text-right' : ''}`}>
        <TeamLink userId={s.userId} year={season.year} className="relative z-10 block font-display text-xl font-bold uppercase leading-none tracking-wide sm:text-[27px]">{teamName(season, s.userId)}</TeamLink>
        {m?.displayName && <div className="mt-1.5 truncate text-sm font-medium text-ink/85 sm:text-base">{m.displayName}</div>}
        <div data-testid={`banner-line-${s.userId}`} className="num mt-0.5 text-xs text-muted">
          {bits.flatMap((x, i) => (i ? [<span key={`dot${i}`} aria-hidden="true"> · </span>, x] : [x]))}
        </div>
      </div>
    );
  };
  const winnerName = view.winner === null ? null : teamName(season, game.sides[view.winner].userId);
  return (
    <section aria-label="Game of the week" className="card blue-wash relative isolate flex min-h-[196px] overflow-hidden">
      <CoverLink to={`/scores/${season.year}/${game.week}/${game.matchupId}`} label={`${teamName(season, a.userId)} vs ${teamName(season, b.userId)}`} />
      <Panel season={season} side={a} />
      <div className="relative grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-5 sm:gap-4 sm:px-4">
        {team(a)}
        <div className="w-40 text-center sm:w-56">
          <div className="font-display text-lg font-bold uppercase leading-none tracking-[0.08em] text-accent sm:text-2xl">Game of the week</div>
          <div className="mt-2.5"><StateLabel status={view.status} /></div>
          <div className="mt-0.5 flex items-baseline justify-center gap-2.5 font-display leading-none">
            <span className={`text-4xl sm:text-[46px] ${scoreTone(view, 0)}`}>{view.scores[0].toFixed(1)}</span>
            <small className="text-xs font-semibold text-muted">VS</small>
            <span className={`text-4xl sm:text-[46px] ${scoreTone(view, 1)}`}>{view.scores[1].toFixed(1)}</span>
          </div>
          {view.status === 'live' && (
            <div className="mt-1 flex justify-between gap-2 text-[11px] text-muted">
              {([0, 1] as const).map((i) => <span key={i}>Proj {view.projected[i].toFixed(1)}{view.toPlay[i] !== null ? ` · ${view.toPlay[i]} to play` : ''}</span>)}
            </div>
          )}
          {view.win && (
            <>
              <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                <span className="bg-accent" style={{ width: `${view.win[0]}%` }} /><span className="bg-coral" style={{ width: `${view.win[1]}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-xs font-semibold"><span className="text-accent">{view.win[0]}%</span><span className="text-coral">{view.win[1]}%</span></div>
            </>
          )}
          {view.status === 'final' && winnerName && <div className="mt-1 text-xs text-muted">{winnerName} by {Math.abs(view.scores[0] - view.scores[1]).toFixed(1)}</div>}
        </div>
        {team(b, true)}
      </div>
      <Panel season={season} side={b} right />
    </section>
  );
}
