import { Link, useLoaderData, useParams } from 'react-router';
import { h2hKey, type GameSide, type Manager, type Season } from '@fantasy-dash/core';
import Avatar from '../components/Avatar';
import EfficiencyBlock from '../components/boxscore/EfficiencyBlock';
import FormBlock from '../components/boxscore/FormBlock';
import HeadToHead from '../components/boxscore/HeadToHead';
import LineupTable from '../components/boxscore/LineupTable';
import WeekScores from '../components/boxscore/WeekScores';
import { history, players } from '../data/load';
import { fmtPpg, fmtPts, fmtRecord, fmtTag } from '../lib/format';

function TeamHeader({ side, manager, outcome, played, align }: {
  side: GameSide; manager?: Manager; outcome: 'won' | 'lost' | 'even'; played: boolean; align: 'left' | 'right';
}) {
  const reverse = align === 'right';
  const name = manager?.teamName ?? manager?.displayName ?? side.userId;
  const tone = !played ? 'text-muted' : outcome === 'won' ? 'font-semibold text-ink' : outcome === 'lost' ? 'text-muted' : 'text-ink';
  return (
    <div className={`flex min-w-0 items-center gap-3 sm:gap-4 ${reverse ? 'sm:flex-row-reverse sm:text-right' : ''}`}>
      <Avatar avatar={manager?.avatar ?? null} name={manager?.displayName ?? '?'} size={48} />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-lg font-semibold sm:text-[22px] leading-tight" title={name}>{name}</div>
        <div className="num mt-1 text-xs text-muted">{manager?.displayName} · {fmtRecord(side.recordBefore)} · {fmtPpg(side.seasonPpg)} ppg</div>
      </div>
      <div className={`num shrink-0 text-[34px] leading-none sm:text-[44px] ${tone}`}>
        {played ? fmtPts(side.points) : fmtPts(side.projected)}
        {!played && <div className="section-label mt-1 text-center text-[10px]">proj</div>}
      </div>
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
  const label = game.tag ? fmtTag(game.tag) : !week.played ? 'Upcoming' : null;
  const outcome = (side: GameSide) =>
    !week.played || game.winner === null ? 'even' as const : game.winner === side.userId ? 'won' as const : 'lost' as const;
  const manager = (side: GameSide): Manager =>
    season.managers[side.userId] ?? { userId: side.userId, displayName: side.userId, teamName: null, avatar: null, rosterId: 0 };

  return (
    <article className="space-y-4">
      <nav className="text-xs text-muted">
        <Link to={`/scores/${season.year}/${game.week}`} className="hover:text-ink">&larr; Scores</Link>
      </nav>
      <header className="card p-5 sm:p-6">
        {label && (
          <div className={`mb-4 text-center text-xs font-semibold uppercase tracking-[0.08em] ${game.tag ? 'text-accent' : 'text-muted'}`}>
            {label}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-6">
          <TeamHeader side={a} manager={season.managers[a.userId]} outcome={outcome(a)} played={week.played} align="left" />
          <div className="section-label hidden text-center text-[13px] lowercase tracking-[0.12em] sm:block" style={{ fontVariant: 'small-caps' }}>vs</div>
          <TeamHeader side={b} manager={season.managers[b.userId]} outcome={outcome(b)} played={week.played} align="right" />
        </div>
      </header>

      <LineupTable sides={game.sides} slots={season.rosterSlots} players={players} seasonTeams={season.playerTeams} />

      {week.played && (
        <div className="grid gap-4 lg:grid-cols-2">
          <EfficiencyBlock sides={game.sides} managers={season.managers} players={players} />
          <FormBlock sides={game.sides} managers={season.managers} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <HeadToHead series={series} year={season.year} week={game.week} left={manager(a)} right={manager(b)} />
        <WeekScores week={week} game={game} managers={season.managers} year={season.year} />
      </div>
    </article>
  );
}
