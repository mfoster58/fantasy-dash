export type UserId = string;
export type PlayerId = string;

export type PlayoffTag =
  | 'QF' | 'SF' | 'Final' | '3rd' | '5th'
  | 'Cons-R1' | 'Toilet Bowl' | 'Cons-7th';

export interface PlayerInfo {
  id: PlayerId;
  name: string;
  firstName: string;
  lastName: string;
  position: string | null;
  team: string | null;
  yearsExp: number | null;
}
export type PlayerDirectory = Record<PlayerId, PlayerInfo>;

export interface Manager {
  userId: UserId;
  displayName: string;
  teamName: string | null;
  avatar: string | null;
  rosterId: number;
}

export interface WLT { w: number; l: number; t: number }

export interface PlayerLine {
  playerId: PlayerId;
  points: number;
  /** null when Sleeper had no projection for this player that week */
  projected: number | null;
  stats: Record<string, number>;
}

export interface SlotEntry {
  slot: string;
  player: PlayerLine | null;
}

export interface Swap {
  /** null when the optimal player fills a slot that was left empty */
  out: PlayerId | null;
  in: PlayerId;
  gain: number;
}

export interface GameSide {
  userId: UserId;
  points: number;
  projected: number;
  ceiling: number;
  /** points / ceiling, 0..1, 4 decimals */
  efficiency: number;
  starters: SlotEntry[];
  bench: PlayerLine[];
  optimalSwaps: Swap[];
  /** regular-season record entering this week */
  recordBefore: WLT;
  /** regular-season PPG for the season through lastScoredWeek */
  seasonPpg: number;
}

export interface Game {
  /** `${year}-${week}-${matchupId}` */
  id: string;
  matchupId: number;
  week: number;
  tag: PlayoffTag | null;
  sides: [GameSide, GameSide];
  winner: UserId | null;
  margin: number;
}

export interface Week {
  week: number;
  isPlayoff: boolean;
  played: boolean;
  games: Game[];
  /** regular season only; null in playoffs or unplayed */
  highScore: UserId | null;
}

export interface AllPlay extends WLT { pct: number }

export interface StandingRow {
  userId: UserId;
  rank: number;
  w: number;
  l: number;
  t: number;
  winPct: number;
  pf: number;
  pa: number;
  ppg: number;
  maxPoints: number;
  efficiency: number;
  /** 'W3', 'L2', or '-' */
  streak: string;
  allPlay: AllPlay;
  weeklyHighs: number;
}

export type BracketKind = 'winners' | 'consolation';

export interface BracketGame {
  bracket: BracketKind;
  round: number;
  matchNo: number;
  placement: number | null;
  week: number;
  tag: PlayoffTag;
  home: UserId | null;
  away: UserId | null;
  homePoints: number | null;
  awayPoints: number | null;
  /** the team that moves on in this bracket's direction (see spec) */
  advanced: UserId | null;
  gameId: string | null;
}

export interface Honors {
  champion: UserId | null;
  runnerUp: UserId | null;
  third: UserId | null;
  pointsTitle: UserId | null;
  lastPlace: UserId | null;
}

export type SeasonStatus = 'complete' | 'in_season';

export interface Season {
  year: number;
  leagueId: string;
  status: SeasonStatus;
  lastScoredWeek: number;
  playoffWeekStart: number;
  playoffTeams: number;
  /** starting slots only, in Sleeper order */
  rosterSlots: string[];
  scoring: Record<string, number>;
  managers: Record<UserId, Manager>;
  /** index = week - 1 */
  weeks: Week[];
  brackets: { winners: BracketGame[]; consolation: BracketGame[] };
  standings: StandingRow[];
  honors: Honors;
}

export interface H2HGame {
  gameId: string;
  year: number;
  week: number;
  tag: PlayoffTag | null;
  aPoints: number;
  bPoints: number;
}

export interface H2HSeries {
  a: UserId;
  b: UserId;
  aWins: number;
  bWins: number;
  ties: number;
  /** consecutive wins by the same manager at the end of the series */
  streak: { holder: UserId | null; length: number };
  totalPoints: { a: number; b: number };
  /** null when no game has been decided */
  biggestWin: { gameId: string; winner: UserId; margin: number } | null;
  /** null when the series is empty; a tie is margin 0 */
  closest: { gameId: string; margin: number } | null;
  avgMargin: number;
  /** newest first */
  games: H2HGame[];
}

export interface HistorySeason {
  year: number;
  leagueId: string;
  status: SeasonStatus;
  lastScoredWeek: number;
  playoffWeekStart: number;
}

export interface History {
  /** oldest first */
  seasons: HistorySeason[];
  managers: Record<UserId, { displayName: string; avatar: string | null; seasons: number[] }>;
  h2h: Record<string, H2HSeries>;
}

/** Stable key for a pair of managers: lexicographically smaller id first. */
export function h2hKey(a: UserId, b: UserId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}
