import type { BoardDef } from './boards/shared';
import { MIN_POST_GAMES, PER_GAME_SUFFIX_MODES, TOUCH_MODES, minGamesCopy, perGameEmpty, perGameModes, pointsModes } from './boards/shared';
import * as career from './boards/career';
import * as extras from './boards/extras';
import * as leaders from './boards/leaders';
import * as post from './boards/postseason';

export * from './boards/shared';
export * from './boards/leaders';
export * from './boards/career';
export * from './boards/postseason';
export * from './boards/extras';

const { bestWeek, bestSeason, careerPoints, weeksStarted } = career;
const { boomStarts, dudStarts, journeyman, draftValue, benchBlunder, benchWarmers, loyalty, ironman, fodder, tradeBait, waiverHeroes, waiverVillains, mrIrrelevant, breakout, fallOff } = extras;
const { leadPoints, leadYards, leadTouchdowns, leadRushYards, leadRecYards, leadPassYards, leadRushTd, leadRecTd, leadPassTd, leadTouches, leadFpoe, leadXfp } = leaders;
const { postPoints, postStarts, postTouchdowns, postYards, postReceptions, championshipRosters, postToiletBowl, lastPlaceRosters, bestPlayoffStarts, worstToiletStarts, PLAYOFF_MODES, CONSOLATION_MODES } = post;

export const BOARDS: BoardDef[] = [
  // League leaders, grid order (3 per row)
  { id: 'leadPoints', section: 'leaders', title: 'Most points', definition: `Fantasy points this season on any roster, started or benched. PPG averages over weeks the player actually played, at least 3 games this season or 12 all-time.`, valueHeader: 'Pts', modes: pointsModes(), empty: perGameEmpty, compute: leadPoints },
  { id: 'leadYards', section: 'leaders', title: 'Most yards', definition: 'Passing, rushing and receiving yards on any roster. Per game averages over weeks the player played.', valueHeader: 'Yds', modes: perGameModes('Yds'), empty: perGameEmpty, compute: leadYards },
  { id: 'leadTouchdowns', section: 'leaders', title: 'Most touchdowns', definition: 'Passing, rushing and receiving touchdowns this season on any roster.', valueHeader: 'TD', compute: leadTouchdowns },
  { id: 'leadRushYards', section: 'leaders', title: 'Rushing yards', definition: 'Rushing yards this season on any roster.', valueHeader: 'Yds', compute: leadRushYards },
  { id: 'leadRecYards', section: 'leaders', title: 'Receiving yards', definition: 'Receiving yards this season on any roster.', valueHeader: 'Yds', compute: leadRecYards },
  { id: 'leadPassYards', section: 'leaders', title: 'Passing yards', definition: 'Passing yards this season on any roster.', valueHeader: 'Yds', compute: leadPassYards },
  { id: 'leadRushTd', section: 'leaders', title: 'Rushing TDs', definition: 'Rushing touchdowns this season on any roster.', valueHeader: 'TD', compute: leadRushTd },
  { id: 'leadRecTd', section: 'leaders', title: 'Receiving TDs', definition: 'Receiving touchdowns this season on any roster.', valueHeader: 'TD', compute: leadRecTd },
  { id: 'leadPassTd', section: 'leaders', title: 'Passing TDs', definition: 'Passing touchdowns this season on any roster.', valueHeader: 'TD', compute: leadPassTd },
  { id: 'leadTouches', section: 'leaders', title: 'Most touches', definition: 'Receptions plus carries this season on any roster. Rec and Car rank one or the other; targets shown underneath.', valueHeader: 'Touches', modes: TOUCH_MODES, modes2: PER_GAME_SUFFIX_MODES, empty: perGameEmpty, compute: leadTouches },
  { id: 'leadFpoe', section: 'leaders', title: 'FPOE', definition: `Fantasy points over expected: actual minus xFP, summed over the season. Over shows the luckiest or most efficient, Under the least. At least 3 modelled games this season or 12 all-time.`, valueHeader: 'FPOE', sortable: true, compute: leadFpoe },
  { id: 'leadXfp', section: 'leaders', title: 'xFP', definition: 'Expected fantasy points from volume: a per-position fit of points on targets, carries and pass attempts across league history. No field position or air yards, so an approximation. QB, RB, WR and TE only.', valueHeader: 'xFP', modes: perGameModes('xFP'), empty: perGameEmpty, compute: leadXfp },
  // Career
  { id: 'bestWeek', section: 'career', title: 'Best week by a starter', definition: 'Most points by a player in one week while in a starting lineup.', valueHeader: 'Pts', compute: bestWeek },
  { id: 'bestSeason', section: 'career', title: 'Best season by a starter', definition: 'Most points a player scored for one manager in one season while started. PPG averages over played starts, at least 3.', valueHeader: 'Pts', modes: pointsModes(), compute: bestSeason },
  { id: 'careerPoints', section: 'career', title: 'Most career points started', definition: `Total points scored while in a starting lineup, every season and manager. PPG averages over played starts, at least 12 games all-time or 3 for a season.`, valueHeader: 'Pts', modes: pointsModes(), empty: perGameEmpty, compute: careerPoints },
  { id: 'weeksStarted', section: 'career', title: 'Most weeks started', definition: 'Weeks in a starting lineup across every season.', valueHeader: 'Starts', compute: weeksStarted },
  // Postseason
  { id: 'postPoints', section: 'postseason', title: 'Most postseason points started', definition: `Points while started in championship-bracket games. PPG averages over played starts, at least ${MIN_POST_GAMES} games.`, valueHeader: 'Pts', modes: pointsModes(), empty: (_ctx, mode) => (mode === 'ppg' ? minGamesCopy(MIN_POST_GAMES) : undefined), compute: postPoints },
  { id: 'postStarts', section: 'postseason', title: 'Most postseason starts', definition: 'Starts in championship-bracket games.', valueHeader: 'Starts', compute: postStarts },
  { id: 'postTouchdowns', section: 'postseason', title: 'Most postseason touchdowns', definition: 'Passing, rushing and receiving touchdowns while started in the championship bracket.', valueHeader: 'TD', compute: postTouchdowns },
  { id: 'postYards', section: 'postseason', title: 'Most postseason yards', definition: 'Passing, rushing and receiving yards while started in the championship bracket.', valueHeader: 'Yds', compute: postYards },
  { id: 'postReceptions', section: 'postseason', title: 'Most postseason receptions', definition: 'Receptions while started in the championship bracket.', valueHeader: 'Rec', compute: postReceptions },
  { id: 'bestPlayoffStarts', section: 'postseason', title: 'Best playoff starts', definition: 'Most points by a starter in one championship-bracket game. Final narrows to the championship game.', valueHeader: 'Pts', modes: PLAYOFF_MODES, compute: bestPlayoffStarts },
  { id: 'championshipRosters', section: 'postseason', title: 'Most championship rosters', definition: "Seasons on the champion's roster, starters and bench, in the championship game. Ties fall to postseason points on that roster.", valueHeader: 'Titles', compute: championshipRosters },
  { id: 'postToiletBowl', section: 'postseason', title: 'Most toilet bowl starts', definition: 'Starts in consolation games: the first round, the toilet bowl and the 7th place game.', valueHeader: 'Starts', compute: postToiletBowl },
  { id: 'worstToiletStarts', section: 'postseason', title: 'Worst toilet bowl starts', definition: 'Fewest points by a starter who played in one consolation game. Toilet Bowl narrows to the last-place game.', valueHeader: 'Pts', modes: CONSOLATION_MODES, compute: worstToiletStarts },
  { id: 'lastPlaceRosters', section: 'postseason', title: 'Most last place rosters', definition: "Seasons on the last-place finisher's roster, starters and bench, in the toilet bowl. Ties fall to consolation points on that roster.", valueHeader: 'Seasons', compute: lastPlaceRosters },
  // Extras
  { id: 'boomStarts', section: 'extras', title: 'Most 30-point starts', definition: 'Weeks a player scored 30 or more while started.', valueHeader: 'Weeks', compute: boomStarts },
  { id: 'dudStarts', section: 'extras', title: 'Most dud starts', definition: 'Weeks a player played and scored under 5 while started. Unplayed weeks do not count. Kickers and defenses excluded.', valueHeader: 'Weeks', compute: dudStarts },
  { id: 'benchBlunder', section: 'extras', title: 'Biggest bench blunder', definition: 'Most points by a player left on the bench in one week.', valueHeader: 'Pts', compute: benchBlunder },
  { id: 'benchWarmers', section: 'extras', title: 'Bench warmers', definition: 'Points scored while sitting on a bench, every season and manager.', valueHeader: 'Pts', compute: benchWarmers },
  { id: 'journeyman', section: 'extras', title: 'Journeyman', definition: 'Different managers who have started the player. Kickers and defenses excluded.', valueHeader: 'Mgrs', compute: journeyman },
  { id: 'loyalty', section: 'extras', title: 'Loyalty', definition: 'Most starts for a single manager. Kickers and defenses excluded.', valueHeader: 'Starts', compute: loyalty },
  { id: 'ironman', section: 'extras', title: 'Ironman', definition: 'Longest run of consecutive league weeks in a starting lineup, any manager, carrying across seasons. Kickers and defenses excluded.', valueHeader: 'Weeks', compute: ironman },
  { id: 'fodder', section: 'extras', title: 'Fodder', definition: 'Times the player was dropped, any manager. Pickups underneath count waiver and free-agent adds.', valueHeader: 'Drops', compute: fodder },
  { id: 'tradeBait', section: 'extras', title: 'Trade bait', definition: 'Completed trades that moved the player, with the number of managers who received him.', valueHeader: 'Trades', compute: tradeBait },
  { id: 'waiverHeroes', section: 'extras', title: 'Waiver heroes', definition: 'Points a waiver claim returned: starts for the claiming manager from the claim until that manager dropped the player. FAAB bid underneath.', valueHeader: 'Pts', compute: waiverHeroes },
  { id: 'waiverVillains', section: 'extras', title: 'Waiver villains', definition: 'FAAB dollars per started point for claims of $10 or more, worst first. A claim that never started counts as one point.', valueHeader: '$/pt', compute: waiverVillains },
  { id: 'draftValue', section: 'extras', title: 'Draft value', definition: "Draft value from the draft board for the chosen season; under All-time, each player's best single season. The current season's value moves weekly.", valueHeader: 'Value', sortable: true, directionLabels: ['+', '\u2212'], compute: draftValue },
  { id: 'mrIrrelevant', section: 'extras', title: 'Mr. Irrelevant', definition: 'The last quarterback, running back, receiver or tight end taken in each draft, and what he went on to score that season, with his positional finish.', valueHeader: 'Pts', compute: mrIrrelevant },
  { id: 'breakout', section: 'extras', title: 'Biggest breakout', definition: 'Largest rise in points per game between two consecutive seasons with at least 10 games in each, league scoring, every NFL game counted. QB, RB, WR and TE.', valueHeader: 'PPG', compute: breakout },
  { id: 'fallOff', section: 'extras', title: 'Biggest fall-off', definition: 'Largest drop in points per game between two consecutive seasons with at least 10 games in each, league scoring, every NFL game counted. QB, RB, WR and TE.', valueHeader: 'PPG', compute: fallOff },
];
