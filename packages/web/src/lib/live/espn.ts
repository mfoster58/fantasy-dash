/** ESPN's public NFL scoreboard: the only feed that says which NFL games are on, in what quarter, with what clock. */
export type NflState = 'pre' | 'in' | 'post';

/** Where the ball is in a game in progress. */
export interface Field {
  /** Sleeper team codes */
  home: string;
  away: string;
  /** who has the ball; null between plays ESPN doesn't describe (kickoffs, breaks) */
  possession: string | null;
  /** yards from the home team's goal line, 0-100 */
  yardLine: number | null;
  /** "1st & 10 at PHI 44" */
  down: string | null;
  redZone: boolean;
}

export interface NflGame {
  /** Sleeper team codes */
  teams: [string, string];
  state: NflState;
  /** 0 before kickoff, 1-4 in regulation, 5+ in overtime */
  period: number;
  /** "4:12" left in the quarter */
  clock: string;
  /** ISO kickoff time */
  kickoff: string;
  halftime: boolean;
  /** only while the game is on */
  field?: Field | null;
  /** Sleeper code of the home team */
  home?: string;
  /** points by Sleeper team code */
  score?: Record<string, number>;
}

/** ESPN codes that differ from Sleeper's */
const ESPN_TO_SLEEPER: Record<string, string> = { WSH: 'WAS' };
export const normTeam = (abbr: string): string => ESPN_TO_SLEEPER[abbr] ?? abbr;

export const scoreboardUrl = (season: number, week: number): string =>
  `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&seasontype=2&week=${week}`;

interface EspnEvent {
  date?: string;
  status?: { period?: number; displayClock?: string; type?: { state?: string; name?: string } };
  competitions?: {
    competitors?: { homeAway?: string; score?: string; team?: { id?: string; abbreviation?: string } }[];
    situation?: { possession?: string; yardLine?: number; downDistanceText?: string; shortDownDistanceText?: string; isRedZone?: boolean };
  }[];
}

function readScore(comp: NonNullable<EspnEvent['competitions']>[number] | undefined): Pick<NflGame, 'home' | 'score'> {
  const teams = comp?.competitors ?? [];
  const home = teams.find((c) => c.homeAway === 'home')?.team?.abbreviation;
  const score: Record<string, number> = {};
  for (const c of teams) {
    const n = Number(c.score);
    if (c.team?.abbreviation && c.score !== undefined && c.score !== '' && Number.isFinite(n)) score[normTeam(c.team.abbreviation)] = n;
  }
  return { ...(home ? { home: normTeam(home) } : {}), ...(Object.keys(score).length === 2 ? { score } : {}) };
}

function readField(comp: NonNullable<EspnEvent['competitions']>[number] | undefined): Field | null {
  const teams = comp?.competitors ?? [];
  const code = (side: string) => teams.find((c) => c.homeAway === side)?.team?.abbreviation;
  const [home, away] = [code('home'), code('away')];
  if (!home || !away) return null;
  const s = comp?.situation ?? {};
  const has = teams.find((c) => s.possession && c.team?.id === s.possession)?.team?.abbreviation;
  return {
    home: normTeam(home), away: normTeam(away),
    possession: has ? normTeam(has) : null,
    yardLine: typeof s.yardLine === 'number' ? s.yardLine : null,
    down: s.downDistanceText || s.shortDownDistanceText || null,
    redZone: !!s.isRedZone,
  };
}

export function parseScoreboard(json: unknown): NflGame[] {
  const events = (json as { events?: EspnEvent[] } | null)?.events;
  if (!Array.isArray(events)) return [];
  const games: NflGame[] = [];
  for (const e of events) {
    const comp = e.competitions?.[0];
    const codes = comp?.competitors?.map((c) => c.team?.abbreviation).filter((a): a is string => !!a) ?? [];
    const state = e.status?.type?.state;
    if (codes.length !== 2 || (state !== 'pre' && state !== 'in' && state !== 'post') || !e.date) continue;
    games.push({
      teams: [normTeam(codes[0]), normTeam(codes[1])],
      state,
      period: e.status?.period ?? 0,
      clock: e.status?.displayClock ?? '0:00',
      kickoff: e.date,
      halftime: e.status?.type?.name === 'STATUS_HALFTIME',
      field: state === 'in' ? readField(comp) : null,
      ...readScore(comp),
    });
  }
  return games;
}
