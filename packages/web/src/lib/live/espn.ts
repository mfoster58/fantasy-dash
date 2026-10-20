/** ESPN's public NFL scoreboard: the only feed that says which NFL games are on, in what quarter, with what clock. */
export type NflState = 'pre' | 'in' | 'post';

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
}

/** ESPN codes that differ from Sleeper's */
const ESPN_TO_SLEEPER: Record<string, string> = { WSH: 'WAS' };
export const normTeam = (abbr: string): string => ESPN_TO_SLEEPER[abbr] ?? abbr;

export const scoreboardUrl = (season: number, week: number): string =>
  `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&seasontype=2&week=${week}`;

interface EspnEvent {
  date?: string;
  status?: { period?: number; displayClock?: string; type?: { state?: string; name?: string } };
  competitions?: { competitors?: { team?: { abbreviation?: string } }[] }[];
}

export function parseScoreboard(json: unknown): NflGame[] {
  const events = (json as { events?: EspnEvent[] } | null)?.events;
  if (!Array.isArray(events)) return [];
  const games: NflGame[] = [];
  for (const e of events) {
    const codes = e.competitions?.[0]?.competitors?.map((c) => c.team?.abbreviation).filter((a): a is string => !!a) ?? [];
    const state = e.status?.type?.state;
    if (codes.length !== 2 || (state !== 'pre' && state !== 'in' && state !== 'post') || !e.date) continue;
    games.push({
      teams: [normTeam(codes[0]), normTeam(codes[1])],
      state,
      period: e.status?.period ?? 0,
      clock: e.status?.displayClock ?? '0:00',
      kickoff: e.date,
      halftime: e.status?.type?.name === 'STATUS_HALFTIME',
    });
  }
  return games;
}
