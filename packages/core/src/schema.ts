import { z } from 'zod';

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
});

export const PlayerDirectorySchema = z.record(z.object({
  id: z.string(),
  name: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  position: z.string().nullable(),
  team: z.string().nullable(),
  yearsExp: z.number().nullable(),
}));

export const HistorySchema = z.object({
  seasons: z.array(z.object({
    year: z.number(),
    leagueId: z.string(),
    status: Status,
    lastScoredWeek: z.number(),
    playoffWeekStart: z.number(),
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
    games: z.array(z.object({
      gameId: z.string(),
      year: z.number(),
      week: z.number(),
      tag: PlayoffTag.nullable(),
      aPoints: z.number(),
      bPoints: z.number(),
    })),
  })),
});
