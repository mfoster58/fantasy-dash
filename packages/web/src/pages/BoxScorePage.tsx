import { Link, useLoaderData, useParams } from 'react-router';
import { computeStandings, h2hKey, type GameSide, type Manager, type Season, type StandingRow } from '@fantasy-dash/core';
import Avatar from '../components/Avatar';
import { ManagerLink, TeamLink } from '../components/NameLink';
import EfficiencyBlock from '../components/boxscore/EfficiencyBlock';
import FormBlock from '../components/boxscore/FormBlock';
import HeadToHead from '../components/boxscore/HeadToHead';
import LineupTable from '../components/boxscore/LineupTable';
import LiveOutlook from '../components/boxscore/LiveOutlook';
import { weekStatus } from '../lib/live/weekStatus';
import PositionBattle from '../components/boxscore/PositionBattle';
import { history, players } from '../data/load';
import { fmtPpg, fmtPts, fmtRecord, fmtStreak, fmtTag } from '../lib/format';
import { playerGames } from '../lib/live/gameState';
import { useLive, useLiveStats } from '../lib/live/LiveProvider';
import { playerTeam } from '../lib/players';

export function TeamHeader({ side, manager, outcome, played, align, entering, year }: {
  side: GameSide; manager?: Manager; outcome: 'won' | 'lost' | 'even'; played: boolean; align: 'left' | 'right'; year: number;
  /** standings row entering this week (undefined before week 1) */
  entering?: StandingRow;
}) {
  const reverse = align === 'right';
  const name = manager?.teamName ?? manager?.displayName ?? side.userId;
  const tone = !played ? 'text-muted' : outcome === 'won' ? 'font-semibold text-ink' : outcome === 'lost' ? 'text-muted' : 'text-ink';
  const streak = entering ? fmtStreak(entering.streak) : null;
  return (
    <div className={`flex min-w-0 items-center gap-3 sm:gap-4 ${reverse ? 'sm:flex-row-reverse sm:text-right' : ''}`}>
      <Avatar avatar={manager?.avatar ?? null} name={manager?.displayName ?? '?'} size={48} />
      <div className="min-w-0 flex-1">
        <TeamLink userId={side.userId} year={year} className="line-clamp-2 text-lg font-semibold sm:text-[22px] leading-tight" title={name}>{name}</TeamLink>
        <div className="num mt-1 text-sm text-muted" data-testid="team-details">
          {manager?.displayName && <ManagerLink userId={side.userId}>{manager.displayName}</ManagerLink>} · {fmtRecord(side.recordBefore)}
          {streak && (
            <span className={`ml-1.5 ${streak.kind === 'W' ? 'text-win' : streak.kind === 'L' ? 'text-loss' : ''}`} title="Streak entering this game">
              {streak.label}<span aria-hidden="true" className="ml-0.5 text-[10px]">{streak.kind === 'W' ? '▲' : streak.kind === 'L' ? '▼' : ''}</span>
            </span>
          )}
          {entering && <span className="ml-1.5" title="League rank entering this game">(#{entering.rank})</span>}
          {' '}· {fmtPpg(side.seasonPpg)} ppg
        </div>
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
  const live = useLive();
  const synced = season.weeks[Number(weekParam) - 1];
  const isLiveWeek = !!synced && live.season?.year === season.year && live.week === synced.week;
  useLiveStats(isLiveWeek);
  const status = synced ? weekStatus(season, synced, live) : null;
  const week = status?.week;
  const game = week?.games.find((g) => g.matchupId === Number(matchupId));
  if (!status || !week || !game) return <p className="text-muted">No such game.</p>;
  const outlook = status.outlookOf(game);
  const gameOf = status.isLive ? playerGames((id) => playerTeam(players, id, season.playerTeams), live.games) : undefined;
  // a live game shows its points once anyone has played; the winner waits for the sync
  const started = outlook ? outlook.status !== 'upcoming' : week.played;

  const [a, b] = game.sides;
  const series = history.h2h[h2hKey(a.userId, b.userId)];
  const label = game.tag ? fmtTag(game.tag)
    : outlook ? ({ upcoming: 'Upcoming', live: 'Live', final: 'Final' } as const)[outlook.status]
      : !week.played ? 'Upcoming' : null;
  const outcome = (side: GameSide) =>
    !week.played || game.winner === null ? 'even' as const : game.winner === side.userId ? 'won' as const : 'lost' as const;
  // Standings as they stood entering this week, for the streak and rank under each team name.
  const entering = game.week > 1 ? computeStandings(season.weeks.slice(0, game.week - 1), Object.keys(season.managers), season.playoffWeekStart) : [];
  const enteringOf = (side: GameSide) => entering.find((r) => r.userId === side.userId);
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
          <TeamHeader side={a} manager={season.managers[a.userId]} outcome={outcome(a)} played={started} align="left" entering={enteringOf(a)} year={season.year} />
          <div className="section-label hidden text-center text-[13px] lowercase tracking-[0.12em] sm:block" style={{ fontVariant: 'small-caps' }}>vs</div>
          <TeamHeader side={b} manager={season.managers[b.userId]} outcome={outcome(b)} played={started} align="right" entering={enteringOf(b)} year={season.year} />
        </div>
      </header>

      {outlook && (
        <LiveOutlook
          outlook={outlook}
          names={[a, b].map((s) => season.managers[s.userId]?.teamName ?? season.managers[s.userId]?.displayName ?? s.userId) as [string, string]}
        />
      )}

      <LineupTable sides={game.sides} slots={season.rosterSlots} players={players} seasonTeams={season.playerTeams} gameOf={gameOf} />

      {week.played && (
        <div className="grid gap-4 lg:grid-cols-2">
          <EfficiencyBlock sides={game.sides} managers={season.managers} players={players} />
          <FormBlock sides={game.sides} managers={season.managers} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <HeadToHead series={series} year={season.year} week={game.week} left={manager(a)} right={manager(b)} />
        <PositionBattle sides={game.sides} slots={season.rosterSlots} managers={season.managers} />
      </div>
    </article>
  );
}
