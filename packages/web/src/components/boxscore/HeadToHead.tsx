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

  return (
    <section className="card p-5" aria-labelledby="h2h-title">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id="h2h-title" className="section-label">Head to head</h2>
        <Link to={`/h2h?a=${left.userId}&b=${right.userId}`} className="text-xs text-accent hover:underline">Full series →</Link>
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
                    className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-3 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2"
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
