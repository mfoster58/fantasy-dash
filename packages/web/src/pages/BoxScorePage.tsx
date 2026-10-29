import { Link, useLoaderData, useParams, useSearchParams } from 'react-router';
import { computeStandings, h2hKey, type GameSide, type Manager, type Season } from '@fantasy-dash/core';
import GameBanner, { teamName } from '../components/home/GameBanner';
import MatchupField from '../components/boxscore/field/MatchupField';
import EfficiencyBlock from '../components/boxscore/EfficiencyBlock';
import FormBlock from '../components/boxscore/FormBlock';
import HeadToHead from '../components/boxscore/HeadToHead';
import LineupTable from '../components/boxscore/LineupTable';
import LiveOutlook from '../components/boxscore/LiveOutlook';
import { weekStatus } from '../lib/live/weekStatus';
import PositionBattle from '../components/boxscore/PositionBattle';
import { history, players } from '../data/load';
import { fmtTag } from '../lib/format';
import { gameView } from '../lib/home/view';
import { playerGames } from '../lib/live/gameState';
import { useLive, useLiveStats } from '../lib/live/LiveProvider';
import { useNflWeek } from '../lib/live/useNflWeek';
import { useDefenseRanks } from '../lib/matchups/useDefenseRanks';
import { playerTeam } from '../lib/players';

export default function BoxScorePage() {
  const season = useLoaderData() as Season;
  const { week: weekParam, matchupId } = useParams();
  // ?replay plays a finished week's field back as if it were live
  const [params] = useSearchParams();
  const live = useLive();
  const synced = season.weeks[Number(weekParam) - 1];
  const isLiveWeek = !!synced && live.season?.year === season.year && live.week === synced.week;
  useLiveStats(isLiveWeek);
  // any other week reads its NFL games once from ESPN, for each player's final score
  // how kind each opponent's defense has been to each position this season
  const matchup = useDefenseRanks(season.year);
  const pastGames = useNflWeek(season.year, Number(weekParam), !!synced && !isLiveWeek);
  const status = synced ? weekStatus(season, synced, live) : null;
  const week = status?.week;
  const game = week?.games.find((g) => g.matchupId === Number(matchupId));
  if (!status || !week || !game) return <p className="text-muted">No such game.</p>;
  const outlook = status.outlookOf(game);
  const teamOf = (id: string) => playerTeam(players, id, season.playerTeams);
  const gameOf = status.isLive ? playerGames(teamOf, live.games) : pastGames ? playerGames(teamOf, pastGames) : undefined;

  const [a, b] = game.sides;
  const series = history.h2h[h2hKey(a.userId, b.userId)];
  // Standings as they stood entering this week, for the streak and rank under each team name.
  const entering = game.week > 1 ? computeStandings(season.weeks.slice(0, game.week - 1), Object.keys(season.managers), season.playoffWeekStart) : [];
  const enteringOf = (userId: string) => entering.find((r) => r.userId === userId);
  const manager = (side: GameSide): Manager =>
    season.managers[side.userId] ?? { userId: side.userId, displayName: side.userId, teamName: null, avatar: null, rosterId: 0 };

  return (
    <article className="space-y-4">
      <nav className="text-xs text-muted">
        <Link to={`/scores/${season.year}/${game.week}`} className="hover:text-ink">&larr; Scores</Link>
      </nav>
      <GameBanner
        game={game} season={season} to={null} odds={false} decimals={2}
        title={game.tag ? fmtTag(game.tag) : `Week ${game.week}`}
        view={gameView(game, outlook, week.played, [status.toPlay(a), status.toPlay(b)])}
        standing={(u) => enteringOf(u)}
      />

      {/* odds only while there's something left to decide; a final result is in the banner */}
      {outlook && outlook.status !== 'final' && <LiveOutlook outlook={outlook} />}

      <LineupTable sides={game.sides} slots={season.rosterSlots} players={players} seasonTeams={season.playerTeams} gameOf={gameOf} matchup={matchup ?? undefined} />

      <MatchupField sides={game.sides} names={[teamName(season, a.userId), teamName(season, b.userId)]} players={players} scoring={season.scoring}
        games={status.isLive ? live.games : pastGames} seasonTeams={season.playerTeams} replay={params.has('replay')} />

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
