import { z } from 'zod';
import type { History, PlayerDirectory, Season } from './types';

const WLT = z.object({ w: z.number(), l: z.number(), t: z.number() });
const PlayoffTag = z.enum(['QF', 'SF', 'Final', '3rd', '5th', 'Cons-R1', 'Toilet Bowl', 'Cons-7th']);
const Status = z.enum(['complete', 'in_season']);

const PlayerLine = z.object({
  playerId: z.string(),
  points: z.number(),
  projected: z.number().nullable(),
  stats: z.record(z.number()),
});
const SlotEntry = z.object({ slot: z.string(), player: PlayerLine.nullable() });
const Swap = z.object({ out: z.string().nullable(), in: z.string(), gain: z.number() });

const GameSide = z.object({
  userId: z.string(),
  points: z.number(),
  projected: z.number(),
  ceiling: z.number(),
  efficiency: z.number(),
  starters: z.array(SlotEntry),
  bench: z.array(PlayerLine),
  optimalSwaps: z.array(Swap),
  recordBefore: WLT,
  seasonPpg: z.number(),
});

const Game = z.object({
  id: z.string(),
  matchupId: z.number(),
  week: z.number(),
  tag: PlayoffTag.nullable(),
  sides: z.tuple([GameSide, GameSide]),
  winner: z.string().nullable(),
  margin: z.number(),
});

const Week = z.object({
  week: z.number(),
  isPlayoff: z.boolean(),
  played: z.boolean(),
  games: z.array(Game),
  highScore: z.string().nullable(),
});

const StandingRow = z.object({
  userId: z.string(),
  rank: z.number(),
  w: z.number(), l: z.number(), t: z.number(),
  winPct: z.number(),
  pf: z.number(), pa: z.number(), ppg: z.number(),
  maxPoints: z.number(),
  efficiency: z.number(),
  streak: z.string(),
  allPlay: WLT.extend({ pct: z.number() }),
  weeklyHighs: z.number(),
});

const BracketGame = z.object({
  bracket: z.enum(['winners', 'consolation']),
  round: z.number(),
  matchNo: z.number(),
  placement: z.number().nullable(),
  week: z.number(),
  tag: PlayoffTag,
  home: z.string().nullable(),
  away: z.string().nullable(),
  homePoints: z.number().nullable(),
  awayPoints: z.number().nullable(),
  advanced: z.string().nullable(),
  gameId: z.string().nullable(),
});

const Manager = z.object({
  userId: z.string(),
  displayName: z.string(),
  teamName: z.string().nullable(),
  avatar: z.string().nullable(),
  rosterId: z.number(),
});

const Honors = z.object({
  champion: z.string().nullable(),
  runnerUp: z.string().nullable(),
  third: z.string().nullable(),
  pointsTitle: z.string().nullable(),
  lastPlace: z.string().nullable(),
});

const DraftPick = z.object({
  round: z.number(),
  pickNo: z.number(),
  slot: z.number(),
  userId: z.string(),
  playerId: z.string(),
  isKeeper: z.boolean(),
  posDraftRank: z.number().nullable(),
  seasonPoints: z.number(),
  gamesPlayed: z.number(),
  ppg: z.number().nullable(),
  healthy: z.boolean(),
  pointsOverBaseline: z.number().nullable(),
  redraftPos: z.number().nullable(),
  contribution: z.number().nullable(),
  earnedPick: z.number().nullable(),
  value: z.number().nullable(),
  tradedTo: z.object({ userId: z.string(), week: z.number() }).nullable(),
});

const Draft = z.object({
  draftId: z.string(),
  type: z.string(),
  rounds: z.number(),
  slotOrder: z.array(z.string()),
  picks: z.array(DraftPick),
  expectedCurve: z.object({ a: z.number(), k: z.number(), c: z.number() }).nullable(),
  baselines: z.record(z.string(), z.object({ baselineRank: z.number(), baselinePoints: z.number(), benchRank: z.number(), benchPoints: z.number() })),
});

const TransactionMove = z.object({ playerId: z.string(), userId: z.string() });
const Transaction = z.object({
  id: z.string(),
  type: z.enum(['trade', 'waiver', 'free_agent', 'commissioner']),
  week: z.number(),
  created: z.number(),
  adds: z.array(TransactionMove),
  drops: z.array(TransactionMove),
  bid: z.number().nullable(),
});

const PlayerSeasonLine = z.object({ points: z.number(), games: z.number(), posRank: z.number().nullable() });

export const SeasonSchema = z.object({
  year: z.number(),
  leagueId: z.string(),
  status: Status,
  lastScoredWeek: z.number(),
  playoffWeekStart: z.number(),
  playoffTeams: z.number(),
  rosterSlots: z.array(z.string()),
  scoring: z.record(z.number()),
  managers: z.record(Manager),
  weeks: z.array(Week),
  brackets: z.object({ winners: z.array(BracketGame), consolation: z.array(BracketGame) }),
  standings: z.array(StandingRow),
  honors: Honors,
  draft: Draft.nullable(),
  transactions: z.array(Transaction),
  playerSeasons: z.record(PlayerSeasonLine),
  playerTeams: z.record(z.string()),
});

export const PlayerDirectorySchema = z.record(z.object({
  id: z.string(),
  name: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  position: z.string().nullable(),
  team: z.string().nullable(),
  yearsExp: z.number().nullable(),
  birthDate: z.string().nullable(),
}));

const AllTimeRow = z.object({
  userId: z.string(),
  rank: z.number(),
  seasons: z.number(),
  w: z.number(), l: z.number(), t: z.number(), winPct: z.number(),
  pf: z.number(), pa: z.number(), ppg: z.number(), maxPoints: z.number(), efficiency: z.number(),
  streak: z.string(),
  allPlay: WLT.extend({ pct: z.number() }),
  weeklyHighs: z.number(),
  titles: z.number(), runnerUps: z.number(), thirds: z.number(),
  playoffApps: z.number(), playoffWins: z.number(), toiletBowls: z.number(),
});

export const HistorySchema = z.object({
  seasons: z.array(z.object({
    year: z.number(),
    leagueId: z.string(),
    status: Status,
    lastScoredWeek: z.number(),
    playoffWeekStart: z.number(),
    honors: Honors,
  })),
  managers: z.record(z.object({
    displayName: z.string(),
    avatar: z.string().nullable(),
    seasons: z.array(z.number()),
  })),
  h2h: z.record(z.object({
    a: z.string(),
    b: z.string(),
    aWins: z.number(),
    bWins: z.number(),
    ties: z.number(),
    streak: z.object({ holder: z.string().nullable(), length: z.number() }),
    totalPoints: z.object({ a: z.number(), b: z.number() }),
    biggestWin: z.object({ gameId: z.string(), winner: z.string(), margin: z.number() }).nullable(),
    closest: z.object({ gameId: z.string(), margin: z.number() }).nullable(),
    avgMargin: z.number(),
    games: z.array(z.object({
      gameId: z.string(),
      year: z.number(),
      week: z.number(),
      tag: PlayoffTag.nullable(),
      aPoints: z.number(),
      bPoints: z.number(),
    })),
  })),
  allTime: z.array(AllTimeRow),
  topDraftValues: z.array(DraftPick.extend({ year: z.number(), teams: z.number() })),
  worstDraftValues: z.array(DraftPick.extend({ year: z.number(), teams: z.number() })),
});

// Compile-time drift guards: a field added to a type without a schema update fails typecheck.
export const _seasonSchemaCheck = SeasonSchema satisfies z.ZodType<Season>;
export const _historySchemaCheck = HistorySchema satisfies z.ZodType<History>;
export const _playersSchemaCheck = PlayerDirectorySchema satisfies z.ZodType<PlayerDirectory>;
