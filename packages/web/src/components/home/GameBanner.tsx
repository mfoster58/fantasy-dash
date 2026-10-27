import type { Game, GameSide, Season } from '@fantasy-dash/core';
import { avatarUrl } from '../Avatar';
import { CoverLink, ManagerLink, TeamLink } from '../NameLink';
import { fmtRecord } from '../../lib/format';
import type { GameView } from '../../lib/home/view';
import { winTone } from '../../lib/live/outlook';

const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
/** a banner needs only the season's managers and year */
export type BannerSeason = Pick<Season, 'managers' | 'year'>;
export const teamName = (season: BannerSeason, userId: string) => season.managers[userId]?.teamName ?? season.managers[userId]?.displayName ?? userId;

export function StateLabel({ status }: { status: GameView['status'] }) {
  if (status === 'live') return <span className="inline-flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-[0.16em] text-loss"><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-loss" />Live</span>;
  if (status === 'final') return <span className="font-display text-xs font-bold uppercase tracking-[0.16em] text-ink">Final</span>;
  return <span className="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Projected</span>;
}
/** neutral until final; then the winner bright and bold, the loser dimmed */
export const scoreTone = (view: GameView, i: 0 | 1) => (view.winner === null ? 'text-ink/85' : view.winner === i ? 'font-bold text-ink' : 'text-muted');

/** where a team stood: its rank and streak (W2, L1) */
export interface BannerStanding { rank: number; streak: string }

const SIZES = {
  hero: {
    box: 'min-h-[196px]', panel: 'w-52 lg:w-64', cut: 40, gold: 'w-[5px] [--at:26px]', stripe: 'w-2 [--at:38px]',
    name: 'text-xl sm:text-[27px]', manager: 'text-sm sm:text-base', center: 'w-40 sm:w-56', title: 'text-lg sm:text-2xl', score: 'text-4xl sm:text-[46px]',
  },
  compact: {
    box: 'min-h-[150px]', panel: 'w-24 lg:w-28', cut: 30, gold: 'w-1 [--at:19px]', stripe: 'w-1.5 [--at:28px]',
    name: 'text-lg sm:text-xl', manager: 'text-xs sm:text-sm', center: 'w-36 sm:w-44', title: 'text-sm', score: 'text-2xl sm:text-[30px]',
  },
};
type Size = (typeof SIZES)['hero'];

/** a photo cut on a diagonal with a team-coloured stripe and a thinner gold one just inside it, both over the photo so it runs past the gold to the cut (the cut's run over the banner's height matches the stripes' 11deg) */
function Panel({ season, side, right, size }: { season: BannerSeason; side: GameSide; right?: boolean; size: Size }) {
  const m = season.managers[side.userId];
  const cut = right ? `polygon(0 0, 100% 0, 100% 100%, ${size.cut}px 100%)` : `polygon(0 0, 100% 0, calc(100% - ${size.cut}px) 100%, 0 100%)`;
  const edge = right ? 'left-[var(--at)] skew-x-[11deg]' : 'right-[var(--at)] -skew-x-[11deg]';
  return (
    <div data-testid="banner-photo" className={`pointer-events-none relative hidden shrink-0 sm:block ${size.panel}`} aria-hidden="true">
      <div className="absolute inset-0" style={{ clipPath: cut }}>
        {m?.avatar
          ? <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${avatarUrl(m.avatar)})` }} />
          : <div className={`absolute inset-0 flex items-center bg-surface-2 px-6 font-display text-4xl font-bold text-muted ${right ? 'justify-end' : ''}`}>{(m?.displayName ?? '?').slice(0, 2).toUpperCase()}</div>}
      </div>
      <div className={`absolute -inset-y-3 ${size.stripe} ${edge} ${right ? 'bg-coral' : 'bg-accent'}`} />
      <div className={`absolute -inset-y-3 ${size.gold} ${edge} bg-gold`} />
    </div>
  );
}

export default function GameBanner({ game, season, view, title = 'Game of the week', compact = false, to, linkLabel, odds = true, decimals = 1, standing, bare = false }: {
  game: Game; season: BannerSeason; view: GameView;
  /** the line over the score; null for none */
  title?: string | null;
  /** the smaller card size, for lists of games */
  compact?: boolean;
  /** where the whole banner links; the box score by default, null for nowhere */
  to?: string | null;
  linkLabel?: string;
  /** the win % bar while the game is to play or on */
  odds?: boolean;
  decimals?: 1 | 2;
  /** each team's rank and streak to show beside its record; left out when not given */
  standing?: (userId: string) => BannerStanding | undefined;
  /** no card of its own, for a banner inside another card */
  bare?: boolean;
}) {
  const size = compact ? SIZES.compact : SIZES.hero;
  const [a, b] = game.sides;
  const href = to === undefined ? `/scores/${season.year}/${game.week}/${game.matchupId}` : to;
  const team = (s: GameSide, right?: boolean) => {
    const m = season.managers[s.userId]; const r = standing?.(s.userId);
    const streak = r && r.streak !== '-' ? r.streak : null;
    const bits = [<span key="rec">{fmtRecord(s.recordBefore)}</span>];
    if (r) bits.push(<span key="rank">{ord(r.rank)}</span>);
    if (streak) bits.push(<span key="strk" className={streak.startsWith('W') ? 'text-win' : streak.startsWith('L') ? 'text-loss' : ''}>{streak}</span>);
    return (
      <div className={`min-w-0 ${right ? 'text-right' : ''}`}>
        <TeamLink userId={s.userId} year={season.year} className={`relative z-10 block font-display font-bold uppercase leading-none tracking-wide ${size.name}`}>{teamName(season, s.userId)}</TeamLink>
        {m?.displayName && <div className={`mt-1.5 truncate font-medium text-ink/85 ${size.manager}`}><ManagerLink userId={s.userId} className="relative z-10">{m.displayName}</ManagerLink></div>}
        <div data-testid={`banner-line-${s.userId}`} className="num mt-0.5 text-xs text-muted">
          {bits.flatMap((x, i) => (i ? [<span key={`dot${i}`} aria-hidden="true"> · </span>, x] : [x]))}
        </div>
      </div>
    );
  };
  const winnerName = view.winner === null ? null : teamName(season, game.sides[view.winner].userId);
  const tied = view.status === 'final' && view.winner === null;
  return (
    <section aria-label={title ?? `${teamName(season, a.userId)} vs ${teamName(season, b.userId)}`} className={`blue-wash relative isolate flex overflow-hidden ${size.box} ${bare ? '' : 'card'}`}>
      {href && <CoverLink to={href} label={linkLabel ?? `${teamName(season, a.userId)} vs ${teamName(season, b.userId)}`} />}
      <Panel season={season} side={a} size={size} />
      {/* not positioned, so it paints under the cover link: clicks on names and scores open the box score; the team and manager links sit above with z-10 */}
      <div data-testid="banner-body" className={`grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 sm:gap-4 sm:px-4 ${compact ? 'py-4' : 'py-5'}`}>
        {team(a)}
        <div className={`text-center ${size.center}`}>
          {title && <div className={`mb-2.5 font-display font-bold uppercase leading-none tracking-[0.08em] text-accent ${size.title}`}>{title}</div>}
          <StateLabel status={view.status} />
          <div className="mt-0.5 flex items-baseline justify-center gap-2.5 font-display leading-none">
            <span className={`${size.score} ${scoreTone(view, 0)}`}>{view.scores[0].toFixed(decimals)}</span>
            <small className="text-xs font-semibold uppercase text-muted">vs</small>
            <span className={`${size.score} ${scoreTone(view, 1)}`}>{view.scores[1].toFixed(decimals)}</span>
          </div>
          {view.status === 'live' && (
            <div className="mt-1 flex justify-between gap-2 text-[11px] text-muted">
              {([0, 1] as const).map((i) => <span key={i}>Proj {view.projected[i].toFixed(1)}{view.toPlay[i] !== null ? ` · ${view.toPlay[i]} to play` : ''}</span>)}
            </div>
          )}
          {odds && view.win && (
            <>
              <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
                {([0, 1] as const).map((i) => <span key={i} data-testid={`banner-win-${i}`} style={{ width: `${view.win![i]}%`, background: winTone(view.win![i], view.win![1 - i]) }} />)}
              </div>
              <div className="mt-1 flex justify-between text-xs font-semibold">
                {([0, 1] as const).map((i) => <span key={i} style={{ color: winTone(view.win![i], view.win![1 - i]) }}>{view.win![i]}%</span>)}
              </div>
            </>
          )}
          {view.status === 'final' && winnerName && <div className="mt-1 text-xs text-muted">{winnerName} by {Math.abs(view.scores[0] - view.scores[1]).toFixed(decimals)}</div>}
          {tied && <div className="mt-1 text-xs text-muted">Tie</div>}
        </div>
        {team(b, true)}
      </div>
      <Panel season={season} side={b} right size={size} />
    </section>
  );
}
