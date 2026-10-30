/** ESPN's game summary: every drive and play of one NFL game, with where each play started and ended. */
import { normTeam, type NflState } from '../live/espn';

export interface EspnPlay {
  id: string;
  driveId: string;
  /** Sleeper code of the team with the ball */
  offense: string;
  /** ESPN's play type: "Rush", "Pass Reception", "Pass Incompletion", ... */
  type: string;
  text: string;
  period: number;
  /** "4:12" left in the quarter */
  clock: string;
  scoring: boolean;
  /** when it happened, ms since the epoch; null when ESPN doesn't say */
  time: number | null;
  /** yards to the end zone before and after the play */
  start: number | null;
  end: number | null;
  /** "2nd & 6 at TEN 20" after the play */
  down: string | null;
}

export interface EspnDrive {
  id: string;
  /** Sleeper code of the team with the ball */
  team: string;
  /** "Touchdown", "Punt", ...; null while it goes on */
  result: string | null;
  scored: boolean;
  /** false for the drive still going */
  complete: boolean;
  playIds: string[];
  /** yards to the end zone where it began */
  from: number | null;
}

export interface EspnGameFeed {
  eventId: string;
  home: string;
  away: string;
  state: NflState;
  drives: EspnDrive[];
  plays: EspnPlay[];
}

export const summaryUrl = (eventId: string): string =>
  `https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`;

interface RawSpot { yardsToEndzone?: number; downDistanceText?: string }
interface RawPlay {
  id?: string; type?: { text?: string }; text?: string; period?: { number?: number }; clock?: { displayValue?: string };
  scoringPlay?: boolean; wallclock?: string; start?: RawSpot; end?: RawSpot;
}
interface RawDrive { id?: string; team?: { abbreviation?: string }; displayResult?: string; isScore?: boolean; plays?: RawPlay[] }
interface RawSummary {
  header?: { id?: string; competitions?: { status?: { type?: { state?: string } }; competitors?: { homeAway?: string; team?: { abbreviation?: string } }[] }[] };
  drives?: { previous?: RawDrive[]; current?: RawDrive };
}

const yte = (s: RawSpot | undefined) => (typeof s?.yardsToEndzone === 'number' ? s.yardsToEndzone : null);

export function parseSummary(json: unknown): EspnGameFeed | null {
  const raw = json as RawSummary | null;
  const comp = raw?.header?.competitions?.[0];
  const code = (side: string) => comp?.competitors?.find((c) => c.homeAway === side)?.team?.abbreviation;
  const [home, away, eventId] = [code('home'), code('away'), raw?.header?.id];
  const state = comp?.status?.type?.state;
  if (!home || !away || !eventId || (state !== 'pre' && state !== 'in' && state !== 'post')) return null;

  // the drive going on now is drives.current; ESPN sometimes lists it among the finished ones too
  const current = raw?.drives?.current;
  const finished = (raw?.drives?.previous ?? []).filter((d) => !current?.id || d.id !== current.id);
  const all = current?.id ? [...finished, current] : finished;
  const drives: EspnDrive[] = [];
  const plays: EspnPlay[] = [];
  for (const d of all) {
    const team = d.team?.abbreviation;
    if (!d.id || !team) continue;
    const complete = d !== current;
    const mine: string[] = [];
    for (const p of d.plays ?? []) {
      if (!p.id) continue;
      mine.push(p.id);
      const t = p.wallclock ? Date.parse(p.wallclock) : NaN;
      plays.push({
        // live text sometimes starts with a stray space (" C.Hubbard right tackle...")
        id: p.id, driveId: d.id, offense: normTeam(team), type: p.type?.text ?? '', text: (p.text ?? '').trim(),
        period: p.period?.number ?? 0, clock: p.clock?.displayValue ?? '', scoring: !!p.scoringPlay,
        time: Number.isFinite(t) ? t : null, start: yte(p.start), end: yte(p.end), down: p.end?.downDistanceText || null,
      });
    }
    drives.push({
      id: d.id, team: normTeam(team), result: complete ? d.displayResult ?? null : null, scored: !!d.isScore, complete,
      playIds: mine, from: yte(d.plays?.[0]?.start),
    });
  }
  return { eventId, home: normTeam(home), away: normTeam(away), state, drives, plays };
}
