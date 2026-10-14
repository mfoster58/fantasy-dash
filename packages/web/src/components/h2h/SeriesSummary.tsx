import { Link } from 'react-router';
import type { H2HSeries, History } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import { fmtPts } from '../../lib/format';

interface Props { series: H2HSeries | undefined; a: string; b: string; managers: History['managers'] }

const linkFor = (gameId: string) => {
  const [year, week, matchupId] = gameId.split('-');
  return `/scores/${year}/${week}/${matchupId}`;
};

export default function SeriesSummary({ series, a, b, managers }: Props) {
  const nameOf = (id: string | null) => (id ? managers[id]?.displayName ?? id : '');
  const meetings = series ? series.aWins + series.bWins + series.ties : 0;
  if (!series || meetings === 0) {
    return <div className="card p-6 text-sm text-muted">{nameOf(a)} and {nameOf(b)} have never met.</div>;
  }
  const flipped = series.a !== a;
  const aWins = flipped ? series.bWins : series.aWins;
  const bWins = flipped ? series.aWins : series.bWins;
  const aPts = flipped ? series.totalPoints.b : series.totalPoints.a;
  const bPts = flipped ? series.totalPoints.a : series.totalPoints.b;
  const streak = series.streak.holder
    ? `${nameOf(series.streak.holder)} has won ${series.streak.length} straight`
    : 'No active streak';

  return (
    <div className="card p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-col items-center gap-2 text-center sm:flex-row sm:gap-3 sm:text-left">
          <Avatar avatar={managers[a]?.avatar ?? null} name={nameOf(a)} size={44} />
          <div className="min-w-0 max-w-full"><div className="truncate text-base font-semibold sm:text-lg">{nameOf(a)}</div><div className="num text-xs text-muted"><span>{fmtPts(aPts)}</span> total</div></div>
        </div>
        <div className="text-center">
          <div data-testid="series-record" className="num whitespace-nowrap text-3xl font-semibold sm:text-4xl">{aWins} – {bWins}</div>
          <div className="section-label mt-1 whitespace-nowrap">{series.ties ? `${meetings} meetings · ${series.ties} tie${series.ties > 1 ? 's' : ''}` : `${meetings} meetings`}</div>
        </div>
        <div className="flex min-w-0 flex-col-reverse items-center gap-2 text-center sm:flex-row sm:justify-end sm:gap-3 sm:text-right">
          <div className="min-w-0 max-w-full"><div className="truncate text-base font-semibold sm:text-lg">{nameOf(b)}</div><div className="num text-xs text-muted"><span>{fmtPts(bPts)}</span> total</div></div>
          <Avatar avatar={managers[b]?.avatar ?? null} name={nameOf(b)} size={44} />
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 sm:grid-cols-4">
        <div><dt className="section-label">Streak</dt><dd className="mt-1 text-sm">{streak}</dd></div>
        <div><dt className="section-label">Biggest win</dt><dd className="mt-1 text-sm">
          {series.biggestWin ? <Link to={linkFor(series.biggestWin.gameId)} className="hover:text-accent">{nameOf(series.biggestWin.winner)} by <span className="num">{fmtPts(series.biggestWin.margin)}</span></Link> : '—'}
        </dd></div>
        <div><dt className="section-label">Closest</dt><dd className="mt-1 text-sm">
          {series.closest ? <Link to={linkFor(series.closest.gameId)} className="hover:text-accent">{series.closest.margin === 0 ? 'Tie' : <>by <span className="num">{fmtPts(series.closest.margin)}</span></>}</Link> : '—'}
        </dd></div>
        <div><dt className="section-label">Avg margin</dt><dd className="num mt-1 text-sm">{fmtPts(series.avgMargin)}</dd></div>
      </dl>
    </div>
  );
}
