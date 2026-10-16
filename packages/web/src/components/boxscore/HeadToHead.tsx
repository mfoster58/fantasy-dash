import { Link } from 'react-router';
import type { H2HGame, H2HSeries, Manager } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import { fmtPts, fmtTag } from '../../lib/format';

interface Props {
  /** Undefined when the two managers have never met. */
  series?: H2HSeries;
  year: number;
  week: number;
  /** The current game's two managers, in display order (left, right). */
  left: Manager;
  right: Manager;
}

const matchupOf = (gameId: string) => gameId.split('-').pop();

/** Series games played strictly before the given year/week, newest first. */
export function priorMeetings(series: H2HSeries | undefined, year: number, week: number): H2HGame[] {
  return (series?.games ?? []).filter((g) => g.year < year || (g.year === year && g.week < week));
}

export interface SeriesExtras {
  /** consecutive wins by the same manager at the end of the prior meetings */
  streak: { holder: string; length: number } | null;
  avgMargin: number;
  biggest: { game: H2HGame; winner: string; margin: number };
  closest: { game: H2HGame; winner: string | null; margin: number };
}

/** Streak, average margin, biggest win and closest game over the prior meetings (newest first); null when there are none. */
export function seriesExtras(prior: H2HGame[], pts: (g: H2HGame) => number[], left?: string, right?: string): SeriesExtras | null {
  if (prior.length === 0) return null;
  const winnerOf = (g: H2HGame): 'left' | 'right' | null => { const [l, r] = pts(g); return l > r ? 'left' : r > l ? 'right' : null; };
  const marginOf = (g: H2HGame) => { const [l, r] = pts(g); return Math.abs(l - r); };
  const name = (w: 'left' | 'right') => (w === 'left' ? left ?? 'left' : right ?? 'right');
  const first = winnerOf(prior[0]);
  let length = 0;
  if (first) for (const g of prior) { if (winnerOf(g) === first) length += 1; else break; }
  const biggestGame = prior.reduce((best, g) => (marginOf(g) > marginOf(best) ? g : best), prior[0]);
  const closestGame = prior.reduce((best, g) => (marginOf(g) < marginOf(best) ? g : best), prior[0]);
  const cw = winnerOf(closestGame);
  return {
    streak: first ? { holder: name(first), length } : null,
    avgMargin: prior.reduce((s, g) => s + marginOf(g), 0) / prior.length,
    biggest: { game: biggestGame, winner: name(winnerOf(biggestGame)!), margin: marginOf(biggestGame) },
    closest: { game: closestGame, winner: cw ? name(cw) : null, margin: marginOf(closestGame) },
  };
}

function Extra({ label, value, sub, to }: { label: string; value: string; sub: string; to?: string }) {
  const body = (
    <>
      <dt className="section-label">{label}</dt>
      <dd className="num mt-0.5 text-lg font-semibold leading-tight">{value}</dd>
      <dd className="truncate text-xs text-muted">{sub}</dd>
    </>
  );
  return to
    ? <Link to={to} className="relative z-10 -m-1.5 block min-w-0 rounded-md p-1.5 hover:bg-surface-2">{body}</Link>
    : <div className="min-w-0">{body}</div>;
}

function Side({ manager, align }: { manager: Manager; align: 'left' | 'right' }) {
  return (
    <div className={`flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:gap-3 ${align === 'right' ? 'sm:flex-row-reverse sm:text-right' : 'sm:text-left'}`}>
      <Avatar avatar={manager.avatar} name={manager.displayName} size={44} />
      <span className="w-full min-w-0 truncate font-semibold sm:w-auto">{manager.displayName}</span>
    </div>
  );
}

export default function HeadToHead({ series, year, week, left, right }: Props) {
  const prior = priorMeetings(series, year, week);
  // Points from the left manager's and right manager's point of view.
  const pts = (g: H2HGame) => (series?.a === left.userId ? [g.aPoints, g.bPoints] : [g.bPoints, g.aPoints]);
  let lw = 0, rw = 0, ties = 0;
  for (const g of prior) {
    const [l, r] = pts(g);
    if (l > r) lw += 1; else if (r > l) rw += 1; else ties += 1;
  }
  const since = prior.length ? Math.min(...prior.map((g) => g.year)) : null;
  const recent = prior.slice(0, 3);
  const extras = seriesExtras(prior, pts, left.userId, right.userId);
  const nameOf = (id: string) => (id === left.userId ? left.displayName : right.displayName);
  const gameLink = (g: H2HGame) => `/scores/${g.year}/${g.week}/${matchupOf(g.gameId)}`;

  return (
    <section className="card relative p-5 transition-colors hover:border-accent" aria-labelledby="h2h-title">
      {/* Covers the card so the whole thing opens the series; the meeting rows sit above it with their own links. */}
      <Link to={`/h2h?a=${left.userId}&b=${right.userId}`} aria-label="Full series →" className="absolute inset-0 rounded-xl" />
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id="h2h-title" className="section-label">Head to head</h2>
        <span className="text-xs text-accent" aria-hidden="true">Full series →</span>
      </div>
      <div className="mx-auto max-w-2xl">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-4">
        <Side manager={left} align="left" />
        <div className="text-center">
          <div className="num whitespace-nowrap text-[36px] font-semibold leading-none" data-testid="h2h-record">
            {lw}<span className="mx-1.5 font-normal text-muted">–</span>{rw}
            {ties > 0 && <span className="text-lg text-muted"> · {ties} tie{ties > 1 ? 's' : ''}</span>}
          </div>
          <div className="section-label mt-2">before this game</div>
          <div className="mt-1 text-xs text-muted">
            {since === null ? 'First meeting' : `${prior.length} prior meeting${prior.length > 1 ? 's' : ''} since ${since}`}
          </div>
        </div>
        <Side manager={right} align="right" />
      </div>

      {extras && (
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-3 sm:grid-cols-4" data-testid="h2h-extras">
          <Extra label="Streak" value={extras.streak ? `${extras.streak.length} in a row` : '—'} sub={extras.streak ? nameOf(extras.streak.holder) : 'None'} />
          <Extra label="Avg margin" value={fmtPts(extras.avgMargin)} sub="points" />
          <Extra label="Biggest win" value={fmtPts(extras.biggest.margin)} sub={`${nameOf(extras.biggest.winner)} · ${extras.biggest.game.year}`} to={gameLink(extras.biggest.game)} />
          <Extra label="Closest" value={fmtPts(extras.closest.margin)} sub={`${extras.closest.margin === 0 ? 'Tie' : nameOf(extras.closest.winner!)} · ${extras.closest.game.year}`} to={gameLink(extras.closest.game)} />
        </dl>
      )}

      {recent.length > 0 && (
        <div className="mt-5 border-t border-line pt-3">
          <h3 className="section-label mb-1.5">Last meetings</h3>
          <ul className="-mx-2">
            {recent.map((g) => {
              const [l, r] = pts(g);
              const winner = l > r ? left.displayName : r > l ? right.displayName : null;
              return (
                <li key={g.gameId}>
                  <Link
                    to={`/scores/${g.year}/${g.week}/${matchupOf(g.gameId)}`}
                    className="relative z-10 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2"
                  >
                    <span className={`truncate text-xs ${g.tag ? 'font-semibold text-accent' : 'text-muted'}`}>
                      {g.year} · {g.tag ? fmtTag(g.tag) : `Wk ${g.week}`}
                    </span>
                    <span className="num whitespace-nowrap">
                      <span className={l > r ? 'font-semibold text-ink' : 'text-muted'}>{fmtPts(l)}</span>
                      <span className="text-muted"> – </span>
                      <span className={r > l ? 'font-semibold text-ink' : 'text-muted'}>{fmtPts(r)}</span>
                    </span>
                    <span className="truncate text-right text-xs text-muted">{winner ? <><span className="text-ink">{winner}</span> won</> : 'Tie'}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      </div>
    </section>
  );
}
