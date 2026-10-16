import type { BoardDef, Tab } from './boards/shared';
import { MIN_POST_GAMES, PER_GAME_SUFFIX_MODES, TOUCH_MODES, minGamesCopy, perGameEmpty, perGameModes, pointsModes } from './boards/shared';
import * as career from './boards/career';
import * as extras from './boards/extras';
import * as leaders from './boards/leaders';
import * as post from './boards/postseason';
import * as pm from './boards/playerMoments';
import * as ps from './boards/playerStreaks';
import * as ma from './boards/managers/alltime';
import * as ms from './boards/managers/seasons';

export * from './boards/shared';
export * from './boards/managers/shared';
export * from './boards/managers/alltime';
export * from './boards/managers/seasons';
export * from './boards/leaders';
export * from './boards/career';
export * from './boards/postseason';
export * from './boards/extras';
export * from './boards/playerMoments';
export * from './boards/playerStreaks';

const { bestWeek, bestSeason, careerPoints, weeksStarted } = career;
const { boomStarts, dudStarts, journeyman, draftValue, benchBlunder, benchWarmers, loyalty, ironman, fodder, waiverHeroes, waiverVillains, mrIrrelevant, breakout, fallOff, pairEmpty } = extras;
const { leadPoints, leadYards, leadTouchdowns, leadRushYards, leadRecYards, leadPassYards, leadRushTd, leadRecTd, leadPassTd, leadTouches, leadFpoe, leadXfp } = leaders;
const { postPoints, postStarts, postTouchdowns, postYards, postReceptions, championshipRosters, postToiletBowl, lastPlaceRosters, bestPlayoffStarts, worstToiletStarts, PLAYOFF_MODES, CONSOLATION_MODES } = post;

const championshipRostersDef = { title: 'Most championship rosters', definition: "Seasons on the champion's roster, starters and bench, in the championship game. Ties fall to postseason points on that roster.", valueHeader: 'Titles', compute: championshipRosters };
const lastPlaceRostersDef = { title: 'Most last place rosters', definition: "Seasons on the last-place finisher's roster, starters and bench, in the toilet bowl. Ties fall to consolation points on that roster.", valueHeader: 'Seasons', compute: lastPlaceRosters };

export const BOARDS: BoardDef[] = [
  // Players → Leaders, grid order (3 per row)
  { id: 'leadPoints', tab: 'players', sub: 'leaders', title: 'Most points', definition: `Fantasy points this season on any roster, started or benched. PPG averages over weeks the player actually played, at least 3 games this season or 12 all-time.`, valueHeader: 'Pts', modes: pointsModes(), empty: perGameEmpty, compute: leadPoints },
  { id: 'leadYards', tab: 'players', sub: 'leaders', title: 'Most yards', definition: 'Passing, rushing and receiving yards on any roster. Per game averages over weeks the player played.', valueHeader: 'Yds', modes: perGameModes('Yds'), empty: perGameEmpty, compute: leadYards },
  { id: 'leadTouchdowns', tab: 'players', sub: 'leaders', title: 'Most touchdowns', definition: 'Passing, rushing and receiving touchdowns this season on any roster.', valueHeader: 'TD', compute: leadTouchdowns },
  { id: 'leadRushYards', tab: 'players', sub: 'leaders', title: 'Rushing yards', definition: 'Rushing yards this season on any roster.', valueHeader: 'Yds', compute: leadRushYards },
  { id: 'leadRecYards', tab: 'players', sub: 'leaders', title: 'Receiving yards', definition: 'Receiving yards this season on any roster.', valueHeader: 'Yds', compute: leadRecYards },
  { id: 'leadPassYards', tab: 'players', sub: 'leaders', title: 'Passing yards', definition: 'Passing yards this season on any roster.', valueHeader: 'Yds', compute: leadPassYards },
  { id: 'leadRushTd', tab: 'players', sub: 'leaders', title: 'Rushing TDs', definition: 'Rushing touchdowns this season on any roster.', valueHeader: 'TD', compute: leadRushTd },
  { id: 'leadRecTd', tab: 'players', sub: 'leaders', title: 'Receiving TDs', definition: 'Receiving touchdowns this season on any roster.', valueHeader: 'TD', compute: leadRecTd },
  { id: 'leadPassTd', tab: 'players', sub: 'leaders', title: 'Passing TDs', definition: 'Passing touchdowns this season on any roster.', valueHeader: 'TD', compute: leadPassTd },
  { id: 'leadTouches', tab: 'players', sub: 'leaders', title: 'Most touches', definition: 'Receptions plus carries this season on any roster. Rec and Car rank one or the other; targets shown underneath.', valueHeader: 'Touches', modes: TOUCH_MODES, modes2: PER_GAME_SUFFIX_MODES, empty: perGameEmpty, compute: leadTouches },
  { id: 'leadFpoe', tab: 'players', sub: 'leaders', title: 'FPOE', definition: `Fantasy points over expected: actual minus xFP, summed over the season. Over shows the luckiest or most efficient, Under the least. At least 3 modelled games this season or 12 all-time.`, valueHeader: 'FPOE', sortable: true, compute: leadFpoe },
  { id: 'leadXfp', tab: 'players', sub: 'leaders', title: 'xFP', definition: 'Expected fantasy points from volume: a per-position fit of points on targets, carries and pass attempts across league history. No field position or air yards, so an approximation. QB, RB, WR and TE only.', valueHeader: 'xFP', modes: perGameModes('xFP'), empty: perGameEmpty, compute: leadXfp },
  // Players → All-time
  { id: 'careerPoints', tab: 'players', sub: 'alltime', title: 'Most career points started', definition: `Total points scored while in a starting lineup, every season and manager. PPG averages over played starts, at least 12 games all-time or 3 for a season.`, valueHeader: 'Pts', modes: pointsModes(), empty: perGameEmpty, compute: careerPoints },
  { id: 'weeksStarted', tab: 'players', sub: 'alltime', title: 'Most weeks started', definition: 'Weeks in a starting lineup across every season.', valueHeader: 'Starts', compute: weeksStarted },
  { id: 'bestSeason', tab: 'players', sub: 'alltime', title: 'Best season by a starter', definition: 'Most points a player scored for one manager in one season while started. PPG averages over played starts, at least 3.', valueHeader: 'Pts', modes: pointsModes(), compute: bestSeason },
  { id: 'championshipRosters', tab: 'players', sub: 'alltime', ...championshipRostersDef },
  { id: 'lastPlaceRosters', tab: 'players', sub: 'alltime', ...lastPlaceRostersDef },
  { id: 'loyalty', tab: 'players', sub: 'alltime', title: 'Loyalty', definition: 'Most starts for a single manager. Kickers and defenses excluded.', valueHeader: 'Starts', compute: loyalty },
  { id: 'journeyman', tab: 'players', sub: 'alltime', title: 'Journeyman', definition: 'Different managers who have started the player. Kickers and defenses excluded.', valueHeader: 'Mgrs', compute: journeyman },
  { id: 'benchWarmers', tab: 'players', sub: 'alltime', title: 'Bench warmers', definition: 'Points scored while sitting on a bench, every season and manager.', valueHeader: 'Pts', compute: benchWarmers },
  { id: 'fodder', tab: 'players', sub: 'alltime', title: 'Fodder', definition: 'Times the player was dropped, any manager. Pickups underneath count waiver and free-agent adds. Kickers and defenses excluded.', valueHeader: 'Drops', compute: fodder },
  { id: 'boomStarts', tab: 'players', sub: 'alltime', title: 'Most 30-point starts', definition: 'Weeks a player scored 30 or more while started.', valueHeader: 'Weeks', compute: boomStarts },
  { id: 'dudStarts', tab: 'players', sub: 'alltime', title: 'Most dud starts', definition: 'Weeks a player played and scored under 5 while started. Unplayed weeks do not count. Kickers and defenses excluded.', valueHeader: 'Weeks', compute: dudStarts },
  { id: 'waiverHeroes', tab: 'players', sub: 'alltime', title: 'Waiver heroes', definition: 'Points a pickup returned: starts for the manager who added the player, from the pickup until that manager dropped him. FAAB bid underneath, or FA for a free-agent add.', valueHeader: 'Pts', compute: waiverHeroes },
  { id: 'waiverVillains', tab: 'players', sub: 'alltime', title: 'Waiver villains', definition: 'FAAB dollars per started point for claims of $10 or more, worst first. A claim that never started counts as one point.', valueHeader: '$/pt', compute: waiverVillains },
  { id: 'draftValue', tab: 'players', sub: 'alltime', title: 'Draft value', definition: "Draft value from the draft board for the chosen season; under All-time, each player's best single season, or worst under −. The current season's value moves weekly.", valueHeader: 'Value', sortable: true, directionLabels: ['+', '−'], compute: draftValue },
  { id: 'mrIrrelevant', tab: 'players', sub: 'alltime', title: 'Mr. Irrelevant', definition: 'The last quarterback, running back, receiver or tight end taken in each draft, and what he went on to score that season, with his positional finish. With a position chosen, the last pick at that position instead.', valueHeader: 'Pts', compute: mrIrrelevant },
  { id: 'topScorerWeeks', tab: 'players', sub: 'alltime', title: 'Most weeks as top scorer', definition: 'Weeks the player was the highest-scoring starter in the league, or at the chosen position. Ties share the week.', valueHeader: 'Weeks', compute: pm.topScorerWeeks },
  // Players → Moments
  { id: 'bestWeek', tab: 'players', sub: 'moments', title: 'Best week by a starter', definition: 'Most points by a player in one week while in a starting lineup.', valueHeader: 'Pts', compute: bestWeek },
  { id: 'benchBlunder', tab: 'players', sub: 'moments', title: 'Biggest bench blunder', definition: 'Most points by a player left on the bench in one week.', valueHeader: 'Pts', compute: benchBlunder },
  { id: 'breakout', tab: 'players', sub: 'moments', title: 'Biggest breakout', definition: 'Largest rise in points per game between two consecutive seasons with at least 10 games in each, league scoring, every NFL game counted. QB, RB, WR and TE.', valueHeader: 'PPG', empty: pairEmpty, compute: breakout },
  { id: 'fallOff', tab: 'players', sub: 'moments', title: 'Biggest fall-off', definition: 'Largest drop in points per game between two consecutive seasons with at least 10 games in each, league scoring, every NFL game counted. QB, RB, WR and TE.', valueHeader: 'PPG', empty: pairEmpty, compute: fallOff },
  { id: 'bestStartInLoss', tab: 'players', sub: 'moments', title: 'Biggest start in a loss', definition: 'Most points by a starter whose team lost that week.', valueHeader: 'Pts', compute: pm.bestStartInLoss },
  { id: 'worstStartInWin', tab: 'players', sub: 'moments', title: 'Lowest start in a win', definition: 'Fewest points by a starter who played on a team that won that week. Kickers and defenses excluded.', valueHeader: 'Pts', compute: pm.worstStartInWin },
  // Players → Streaks
  { id: 'ironman', tab: 'players', sub: 'streaks', title: 'Ironman', definition: 'Longest run of consecutive league weeks in a starting lineup, any manager, carrying across seasons. Kickers and defenses excluded.', valueHeader: 'Weeks', compute: ironman },
  { id: 'run15', tab: 'players', sub: 'streaks', title: 'Longest run of 15+ point starts', definition: 'Consecutive starts scoring 15 or more, any manager. A start under 15 ends the run; weeks on a bench or off a roster do not.', valueHeader: 'Starts', compute: ps.run15 },
  { id: 'run20', tab: 'players', sub: 'streaks', title: 'Longest run of 20+ point starts', definition: 'Consecutive starts scoring 20 or more, any manager. A start under 20 ends the run; weeks on a bench or off a roster do not.', valueHeader: 'Starts', compute: ps.run20 },
  { id: 'drought', tab: 'players', sub: 'streaks', title: 'Longest scoring drought', definition: 'Consecutive played starts under 5 points, any manager. Kickers and defenses excluded.', valueHeader: 'Starts', compute: ps.drought },
  { id: 'posTopRun', tab: 'players', sub: 'streaks', title: 'Most consecutive weeks as top at position', definition: "Consecutive league weeks as the highest-scoring starter at the player's position. A week not on top, started or not, ends the run.", valueHeader: 'Weeks', compute: ps.posTopRun },
  // Players → Postseason
  { id: 'postPoints', tab: 'players', sub: 'postseason', title: 'Most postseason points started', definition: `Points while started in championship-bracket games. PPG averages over played starts, at least ${MIN_POST_GAMES} games.`, valueHeader: 'Pts', modes: pointsModes(), empty: (_ctx, mode) => (mode === 'ppg' ? minGamesCopy(MIN_POST_GAMES) : undefined), compute: postPoints },
  { id: 'postStarts', tab: 'players', sub: 'postseason', title: 'Most postseason starts', definition: 'Starts in championship-bracket games.', valueHeader: 'Starts', compute: postStarts },
  { id: 'postTouchdowns', tab: 'players', sub: 'postseason', title: 'Most postseason touchdowns', definition: 'Passing, rushing and receiving touchdowns while started in the championship bracket.', valueHeader: 'TD', compute: postTouchdowns },
  { id: 'postYards', tab: 'players', sub: 'postseason', title: 'Most postseason yards', definition: 'Passing, rushing and receiving yards while started in the championship bracket.', valueHeader: 'Yds', compute: postYards },
  { id: 'postReceptions', tab: 'players', sub: 'postseason', title: 'Most postseason receptions', definition: 'Receptions while started in the championship bracket.', valueHeader: 'Rec', compute: postReceptions },
  { id: 'bestPlayoffStarts', tab: 'players', sub: 'postseason', title: 'Best playoff starts', definition: 'Most points by a starter in one championship-bracket game. Final narrows to the championship game.', valueHeader: 'Pts', modes: PLAYOFF_MODES, compute: bestPlayoffStarts },
  { id: 'postChampionshipRosters', tab: 'players', sub: 'postseason', ...championshipRostersDef },
  { id: 'postToiletBowl', tab: 'players', sub: 'postseason', title: 'Most toilet bowl starts', definition: 'Starts in consolation games: the first round, the toilet bowl and the 7th place game.', valueHeader: 'Starts', compute: postToiletBowl },
  { id: 'worstToiletStarts', tab: 'players', sub: 'postseason', title: 'Worst toilet bowl starts', definition: 'Fewest points by a starter who played in one consolation game. Toilet Bowl narrows to the last-place game.', valueHeader: 'Pts', modes: CONSOLATION_MODES, compute: worstToiletStarts },
  { id: 'postLastPlaceRosters', tab: 'players', sub: 'postseason', ...lastPlaceRostersDef },
  // Managers → All-time
  { id: 'mCareerWins', tab: 'managers', sub: 'malltime', title: 'Most career wins', definition: 'Regular-season wins across every season.', valueHeader: 'Wins', compute: ma.mCareerWins },
  { id: 'mWinPct', tab: 'managers', sub: 'malltime', title: 'Best career win %', definition: 'Regular-season win percentage, ties as half a win. At least one complete season.', valueHeader: 'Win %', compute: ma.mWinPct },
  { id: 'mWorstWinPct', tab: 'managers', sub: 'malltime', title: 'Worst career win %', definition: 'Regular-season win percentage, ties as half a win, lowest first. At least one complete season.', valueHeader: 'Win %', compute: ma.mWorstWinPct },
  { id: 'mCareerPoints', tab: 'managers', sub: 'malltime', title: 'Most career points', definition: 'Regular-season points scored across every season.', valueHeader: 'Pts', compute: ma.mCareerPoints },
  { id: 'mCareerPpg', tab: 'managers', sub: 'malltime', title: 'Best career points per game', definition: 'Regular-season points per game. At least one complete season.', valueHeader: 'PPG', compute: ma.mCareerPpg },
  { id: 'mPointsAgainst', tab: 'managers', sub: 'malltime', title: 'Most career points against', definition: 'Regular-season points scored by opponents across every season.', valueHeader: 'Pts', compute: ma.mPointsAgainst },
  { id: 'mTitles', tab: 'managers', sub: 'malltime', title: 'Most championships', definition: 'Championship game wins.', valueHeader: 'Titles', compute: ma.mTitles },
  { id: 'mFinals', tab: 'managers', sub: 'malltime', title: 'Most title games', definition: 'Championship game appearances, won or lost.', valueHeader: 'Finals', compute: ma.mFinals },
  { id: 'mBerths', tab: 'managers', sub: 'malltime', title: 'Most playoff berths', definition: 'Seasons in the championship bracket.', valueHeader: 'Berths', compute: ma.mBerths },
  { id: 'mPlayoffWins', tab: 'managers', sub: 'malltime', title: 'Most playoff wins', definition: 'Wins in championship-bracket games.', valueHeader: 'Wins', compute: ma.mPlayoffWins },
  { id: 'mBerthsNoTitle', tab: 'managers', sub: 'malltime', title: 'Most berths without a title', definition: 'Playoff berths by managers who have never won the championship.', valueHeader: 'Berths', compute: ma.mBerthsNoTitle },
  { id: 'mLastPlaces', tab: 'managers', sub: 'malltime', title: 'Most last-place finishes', definition: 'Seasons finishing last, by the toilet bowl where the league plays one.', valueHeader: 'Seasons', compute: ma.mLastPlaces },
  { id: 'mSeasons', tab: 'managers', sub: 'malltime', title: 'Most seasons played', definition: 'Seasons with a standings row, the current one included.', valueHeader: 'Seasons', compute: ma.mSeasons },
  { id: 'mEfficiency', tab: 'managers', sub: 'malltime', title: 'Best lineup efficiency', definition: 'Points started divided by the points the best possible lineup would have scored, over every game played, playoffs included. At least one complete season.', valueHeader: 'Eff', compute: ma.mEfficiency },
  { id: 'mWorstEfficiency', tab: 'managers', sub: 'malltime', title: 'Worst lineup efficiency', definition: 'Points started divided by the best possible lineup, lowest first, over every game played. At least one complete season.', valueHeader: 'Eff', compute: ma.mWorstEfficiency },
  { id: 'mWeeklyHighs', tab: 'managers', sub: 'malltime', title: 'Most weekly high scores', definition: 'Regular-season weeks with the top score in the league.', valueHeader: 'Weeks', compute: ma.mWeeklyHighs },
  // Managers → Seasons
  { id: 'msPoints', tab: 'managers', sub: 'mseasons', title: 'Most points in a season', definition: 'Regular-season points. Under All-time, complete seasons only.', valueHeader: 'Pts', compute: ms.msPoints },
  { id: 'msFewest', tab: 'managers', sub: 'mseasons', title: 'Fewest points in a season', definition: 'Regular-season points, lowest first. Under All-time, complete seasons only.', valueHeader: 'Pts', compute: ms.msFewest },
  { id: 'msPpg', tab: 'managers', sub: 'mseasons', title: 'Best points per game', definition: 'Regular-season points per game, at least 3 games.', valueHeader: 'PPG', compute: ms.msPpg },
  { id: 'msAgainst', tab: 'managers', sub: 'mseasons', title: 'Most points against', definition: 'Regular-season points scored by opponents. Under All-time, complete seasons only.', valueHeader: 'Pts', compute: ms.msAgainst },
  { id: 'msRecord', tab: 'managers', sub: 'mseasons', title: 'Best record', definition: 'Regular-season win percentage, ties as half, points for breaking ties. At least 3 games.', valueHeader: 'Win %', compute: ms.msRecord },
  { id: 'msWorstRecord', tab: 'managers', sub: 'mseasons', title: 'Worst record', definition: 'Regular-season win percentage, lowest first, fewer points breaking ties. At least 3 games.', valueHeader: 'Win %', compute: ms.msWorstRecord },
  { id: 'msDiff', tab: 'managers', sub: 'mseasons', title: 'Biggest points differential', definition: 'Regular-season points for minus points against.', valueHeader: '+/−', compute: ms.msDiff },
  { id: 'msAllPlay', tab: 'managers', sub: 'mseasons', title: 'Best season vs everyone', definition: 'All-play win percentage: the record against every other team every week. At least 3 games.', valueHeader: 'All-play', compute: ms.msAllPlay },
  { id: 'msWorstAllPlay', tab: 'managers', sub: 'mseasons', title: 'Worst season vs everyone', definition: 'All-play win percentage, lowest first. At least 3 games.', valueHeader: 'All-play', compute: ms.msWorstAllPlay },
  { id: 'msLucky', tab: 'managers', sub: 'mseasons', title: 'Luckiest season', definition: 'Actual wins minus the wins the all-play record implies over the same games: the schedule gave them this many extra wins. At least 3 games.', valueHeader: 'Wins', compute: ms.msLucky },
  { id: 'msUnlucky', tab: 'managers', sub: 'mseasons', title: 'Unluckiest season', definition: 'Actual wins minus the wins the all-play record implies, most negative first. At least 3 games.', valueHeader: 'Wins', compute: ms.msUnlucky },
  { id: 'msNoTitle', tab: 'managers', sub: 'mseasons', title: 'Best team without the title', definition: 'Best all-play win percentage among seasons whose manager did not win the championship. Complete seasons only.', valueHeader: 'All-play', compute: ms.msNoTitle },
  { id: 'msEfficiency', tab: 'managers', sub: 'mseasons', title: 'Best lineup efficiency', definition: 'Points started divided by the best possible lineup, over every game that season, playoffs included.', valueHeader: 'Eff', compute: ms.msEfficiency },
  { id: 'msWorstEfficiency', tab: 'managers', sub: 'mseasons', title: 'Worst lineup efficiency', definition: 'Points started divided by the best possible lineup, lowest first, over every game that season.', valueHeader: 'Eff', compute: ms.msWorstEfficiency },
  { id: 'msBench', tab: 'managers', sub: 'mseasons', title: 'Most points left on the bench', definition: 'Points the best possible lineup would have added, summed over every game that season.', valueHeader: 'Pts', compute: ms.msBench },
];

export const boardsFor = (tab: Tab, sub: string): BoardDef[] => BOARDS.filter((b) => b.tab === tab && b.sub === sub);
