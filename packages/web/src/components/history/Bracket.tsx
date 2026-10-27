import type { BracketGame, BracketKind, Manager, UserId } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import { FinishIcon } from '../Icons';
import { CoverLink, TeamLink } from '../NameLink';
import { fmtTag } from '../../lib/format';

interface Props {
  games: BracketGame[]; kind: BracketKind; managers: Record<UserId, Manager>; year: number;
  /** each team's seed, shown before its name */
  seeds?: Record<UserId, number>;
}

const roundTitle = (kind: BracketKind, games: BracketGame[], round: number) => {
  const tags = new Set(games.map((g) => g.tag));
  // A column of one kind of game takes that game's name; consolation round 1
  // ("Consolation") would repeat the section heading, so it falls back to the round.
  if (tags.size === 1 && !(kind === 'consolation' && games[0].tag === 'Cons-R1')) return fmtTag(games[0].tag);
  return `Round ${round}`;
};

const teamOf = (id: UserId | null, managers: Record<UserId, Manager>) => (id ? managers[id]?.teamName ?? managers[id]?.displayName ?? id : 'TBD');

/**
 * Winners bracket: the advancing team won. Consolation is a toilet bowl where the
 * lower scorer advances, so the game's winner is the higher scorer.
 */
function wonBy(g: BracketGame, kind: BracketKind, side: 'home' | 'away'): boolean {
  if (kind === 'winners') return g.advanced !== null && g.advanced === (side === 'home' ? g.home : g.away);
  if (g.homePoints === null || g.awayPoints === null) return false;
  return side === 'home' ? g.homePoints > g.awayPoints : g.awayPoints > g.homePoints;
}

type Tone = 'plain' | 'gold' | 'coral';

function Row({ id, points, won, crown, managers, year, seed, big }: {
  id: UserId | null; points: number | null; won: boolean; managers: Record<UserId, Manager>; year: number; seed?: number;
  /** "Champion" or "Last place", on the side that earned it */
  crown: { label: string; tone: string; kind: 'champion' | 'toilet' } | null;
  big: boolean;
}) {
  const m = id ? managers[id] : undefined;
  const decided = points !== null;
  return (
    <div data-testid="bracket-row" className={`relative flex items-center gap-2.5 px-3 ${big ? 'py-2.5' : 'py-2'} ${decided && !won ? 'opacity-55' : ''}`}>
      {won && <span aria-hidden="true" className="absolute inset-y-1 left-0 w-1 rounded-r bg-accent" />}
      <span className="num w-4 shrink-0 text-right text-xs text-muted" data-testid={id && seed !== undefined ? `seed-${id}` : undefined}>{id ? seed ?? '' : ''}</span>
      {id ? <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={big ? 30 : 24} /> : <span className={`${big ? 'h-[30px] w-[30px]' : 'h-6 w-6'} shrink-0 rounded-full border border-dashed border-line`} />}
      <span className="min-w-0 flex-1 leading-tight">
        {id
          ? <TeamLink userId={id} year={year} className={`relative z-10 line-clamp-2 font-display font-bold uppercase leading-tight tracking-wide ${big ? 'text-lg' : 'text-[15px]'} ${won ? 'text-ink' : 'text-ink/85'}`}>{teamOf(id, managers)}</TeamLink>
          : <span className="block font-display text-[15px] font-semibold uppercase tracking-wide text-muted">TBD</span>}
        {crown && <span className={`flex items-center gap-1 font-display text-[11px] font-bold uppercase tracking-[0.16em] ${crown.tone}`}><FinishIcon kind={crown.kind} size="1.15em" />{crown.label}</span>}
      </span>
      {won && <span className="sr-only">winner</span>}
      <span className={`shrink-0 font-display tabular-nums ${big ? 'text-2xl' : 'text-lg'} ${won ? 'font-bold text-ink' : 'text-ink/80'}`}>{points === null ? '' : points.toFixed(2)}</span>
    </div>
  );
}

function Game({ g, kind, managers, year, seeds, tone = 'plain', title, icon, side }: {
  g: BracketGame; kind: BracketKind; managers: Record<UserId, Manager>; year: number; seeds?: Record<UserId, number>;
  tone?: Tone;
  /** a heading inside the card: the final's name, or a placement game's */
  title?: string;
  /** an icon before the title */
  icon?: React.ReactNode;
  /** which way the line to the next round runs */
  side?: 'left' | 'right';
}) {
  const matchupId = g.gameId?.split('-').pop();
  const big = tone !== 'plain';
  const crown = (s: 'home' | 'away') => {
    const id = s === 'home' ? g.home : g.away;
    if (g.placement !== 1 || !id || g.advanced !== id) return null;
    return kind === 'winners' ? { label: 'Champion', tone: 'text-gold', kind: 'champion' as const } : { label: 'Last place', tone: 'text-coral', kind: 'toilet' as const };
  };
  const frame = tone === 'gold'
    ? 'border-gold/60 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--gold)_22%,var(--surface))_0%,var(--surface)_70%)] shadow-[0_0_40px_-12px_color-mix(in_srgb,var(--gold)_55%,transparent)]'
    : tone === 'coral'
      ? 'border-coral/55 bg-[linear-gradient(160deg,color-mix(in_srgb,var(--coral)_18%,var(--surface))_0%,var(--surface)_70%)]'
      : 'blue-wash border-line';
  // a line from each card toward the round it feeds
  const line = side === 'left' ? 'after:absolute after:left-full after:top-1/2 after:h-0.5 after:w-8 after:bg-accent/40'
    : side === 'right' ? 'before:absolute before:right-full before:top-1/2 before:h-0.5 before:w-8 before:bg-accent/40' : '';
  return (
    <div data-testid="bracket-game" data-match={g.matchNo} className={`relative ${line}`}>
      <div className={`relative isolate overflow-hidden rounded-xl border ${frame} ${g.gameId ? 'transition-colors hover:border-accent' : ''}`}>
        {g.gameId && <CoverLink to={`/scores/${year}/${g.week}/${matchupId}`} label={`${fmtTag(g.tag)}: ${teamOf(g.home, managers)} vs ${teamOf(g.away, managers)} box score`} />}
        {title && (
          <div className={`px-3 pt-2.5 font-display font-bold uppercase leading-none tracking-[0.12em] ${tone === 'gold' ? 'text-xl text-gold' : tone === 'coral' ? 'text-xl text-coral' : 'text-xs text-muted'}`}>{icon && <span className="mr-1.5 inline-flex align-[-0.1em]">{icon}</span>}{title}</div>
        )}
        <Row id={g.home} points={g.homePoints} won={wonBy(g, kind, 'home')} crown={crown('home')} managers={managers} year={year} seed={g.home ? seeds?.[g.home] : undefined} big={big} />
        <div className="mx-3 h-px bg-line/70" />
        <Row id={g.away} points={g.awayPoints} won={wonBy(g, kind, 'away')} crown={crown('away')} managers={managers} year={year} seed={g.away ? seeds?.[g.away] : undefined} big={big} />
      </div>
    </div>
  );
}

const ColumnTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-3 text-center font-display text-sm font-bold uppercase tracking-[0.16em] text-accent">{children}</div>
);

/**
 * A playoff draw: the rounds before the final split into two halves that converge on it from the left and right,
 * the final in the middle (gold for the championship, coral for the toilet bowl), and the placement games underneath.
 */
export default function Bracket({ games, kind, managers, year, seeds }: Props) {
  const lastRound = Math.max(...games.map((g) => g.round));
  // Sleeper marks the final with placement 1; without that, the last round's deciding game
  const final = games.find((g) => g.placement === 1) ?? games.find((g) => g.round === lastRound && g.placement === null);
  const finalRound = final?.round ?? lastRound;
  const placements = games.filter((g) => g.placement !== null && g !== final).sort((a, b) => (a.placement ?? 0) - (b.placement ?? 0));
  const rounds = [...new Set(games.filter((g) => g.placement === null && g.round < finalRound).map((g) => g.round))].sort((a, b) => a - b);
  const halves = rounds.map((round) => {
    const inRound = games.filter((g) => g.round === round && g.placement === null).sort((a, b) => a.matchNo - b.matchNo);
    const cut = Math.ceil(inRound.length / 2);
    return { round, title: roundTitle(kind, inRound, round), left: inRound.slice(0, cut), right: inRound.slice(cut) };
  });
  const column = (round: number, title: string, list: BracketGame[], side: 'left' | 'right') => (
    // an empty half (a round with a single game) keeps its column, without a title
    <div key={`${side}-${round}`} className="flex flex-col">
      <ColumnTitle>{list.length ? title : ''}</ColumnTitle>
      <div className="flex flex-1 flex-col justify-around gap-4">
        {list.map((g) => <Game key={g.matchNo} g={g} kind={kind} managers={managers} year={year} seeds={seeds} side={side} />)}
      </div>
    </div>
  );
  const center = kind === 'winners' ? 'gold' : 'coral';
  return (
    <div className="overflow-x-auto pb-2">
      <div className={rounds.length ? 'min-w-[880px]' : ''}>
        <div className="grid gap-x-8" style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(0, 1fr)) minmax(260px, 1.25fr) repeat(${rounds.length}, minmax(0, 1fr))` }}>
          <div data-testid="bracket-left" className="contents">
            {halves.map((h) => column(h.round, h.title, h.left, 'left'))}
          </div>
          <div data-testid="bracket-center" className="flex flex-col">
            <ColumnTitle>{final ? (kind === 'winners' ? 'Final' : 'Final round') : ''}</ColumnTitle>
            <div className="flex flex-1 flex-col justify-center">
              {final && <Game g={final} kind={kind} managers={managers} year={year} seeds={seeds} tone={center} icon={<FinishIcon kind={kind === 'winners' ? 'champion' : 'toilet'} size="1em" />} title={fmtTag(final.tag)} />}
            </div>
          </div>
          <div data-testid="bracket-right" className="contents">
            {[...halves].reverse().map((h) => column(h.round, h.title, h.right, 'right'))}
          </div>
        </div>
        {placements.length > 0 && (
          <div data-testid="bracket-placements" className={`mx-auto mt-8 grid gap-4 ${placements.length > 1 ? 'max-w-3xl sm:grid-cols-2' : 'max-w-sm'}`}>
            {placements.map((g) => <Game key={g.matchNo} g={g} kind={kind} managers={managers} year={year} seeds={seeds} title={fmtTag(g.tag)} />)}
          </div>
        )}
      </div>
    </div>
  );
}
