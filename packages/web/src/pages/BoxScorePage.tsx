import { Link, useLoaderData, useParams } from 'react-router';
import { h2hKey, type GameSide, type Manager, type Season } from '@fantasy-dash/core';
import Avatar from '../components/Avatar';
import EfficiencyBlock from '../components/boxscore/EfficiencyBlock';
import FormBlock from '../components/boxscore/FormBlock';
import LineupTable from '../components/boxscore/LineupTable';
import { history, players } from '../data/load';
import { fmtPpg, fmtPts, fmtRecord, fmtTag } from '../lib/format';

function TeamHeader({ side, manager, won, played, align }: { side: GameSide; manager?: Manager; won: boolean; played: boolean; align: 'left' | 'right' }) {
  const reverse = align === 'right';
  return (
    <div className={`flex min-w-0 items-center gap-3 ${reverse ? 'sm:flex-row-reverse sm:text-right' : ''}`}>
      <Avatar avatar={manager?.avatar ?? null} name={manager?.displayName ?? '?'} size={40} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{manager?.teamName ?? manager?.displayName ?? side.userId}</div>
        <div className="num text-xs text-muted">{manager?.displayName} · {fmtRecord(side.recordBefore)} · {fmtPpg(side.seasonPpg)} ppg</div>
      </div>
      <div className={`num text-2xl ${won ? 'font-semibold' : 'text-muted'}`}>{played ? fmtPts(side.points) : fmtPts(side.projected)}</div>
    </div>
  );
}

export default function BoxScorePage() {
  const season = useLoaderData() as Season;
  const { week: weekParam, matchupId } = useParams();
  const week = season.weeks[Number(weekParam) - 1];
  const game = week?.games.find((g) => g.matchupId === Number(matchupId));
  if (!week || !game) return <p className="text-muted">No such game.</p>;

  const [a, b] = game.sides;
  const series = history.h2h[h2hKey(a.userId, b.userId)];
  const winsFor = (userId: string) => (series ? (series.a === userId ? series.aWins : series.bWins) : 0);
  const ties = series?.ties ?? 0;
  const label = [game.tag ? fmtTag(game.tag) : `Week ${game.week}`, !week.played ? 'Upcoming' : game.winner === null ? 'Tie' : null].filter(Boolean).join(' · ');

  return (
    <article className="space-y-4">
      <nav className="text-xs text-muted">
        <Link to={`/scores/${season.year}/${game.week}`} className="hover:text-ink">&larr; {season.year} week {game.week}</Link>
      </nav>
      <header className="card p-5">
        <div className="section-label mb-3">{label}</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <TeamHeader side={a} manager={season.managers[a.userId]} won={game.winner === a.userId} played={week.played} align="left" />
          <div className="hidden text-center text-xs text-muted sm:block">{week.played ? 'Final' : 'Proj'}</div>
          <TeamHeader side={b} manager={season.managers[b.userId]} won={game.winner === b.userId} played={week.played} align="right" />
        </div>
      </header>

      <LineupTable sides={game.sides} slots={season.rosterSlots} players={players} />

      {week.played && (
        <div className="grid gap-4 lg:grid-cols-2">
          <EfficiencyBlock sides={game.sides} managers={season.managers} players={players} />
          <FormBlock sides={game.sides} managers={season.managers} />
        </div>
      )}

      <footer className="card px-5 py-3 text-sm">
        <span className="text-muted">All-time series: </span>
        <span className="font-medium">{season.managers[a.userId]?.displayName}</span>{' '}
        <span className="num">{winsFor(a.userId)}</span>
        <span className="text-muted"> to </span>
        <span className="num">{winsFor(b.userId)}</span>{' '}
        <span className="font-medium">{season.managers[b.userId]?.displayName}</span>
        {ties > 0 && <span className="text-muted"> ({ties} tie{ties > 1 ? 's' : ''})</span>}
      </footer>
    </article>
  );
}
