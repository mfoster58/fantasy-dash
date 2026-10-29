import type { EspnGameFeed } from './espnGame';

/** how long a drive that scored stays up after its last play, for the touchdown to be seen */
export const SCORE_HOLD_MS = 45_000;

/** play types after which the drive is over: the ball changed hands or points went up */
const GAVE_UP = /punt|interception|fumble recovery \(opponent\)|field goal|touchdown|safety|turnover on downs|blocked/i;

export interface LiveDrive {
  /** ESPN's drive id */
  key: string;
  eventId: string;
  /** Sleeper code of the team with the ball */
  team: string;
  /** yards to the end zone where it began, and where the ball is now */
  from: number | null;
  spot: number | null;
  /** "2nd & 6 at TEN 20" */
  down: string | null;
  /** "Touchdown" or "Field Goal" once it scored; null while it goes on */
  result: string | null;
}

/**
 * The drives on right now in games still going, for the given teams. A drive leaves the field the moment ESPN
 * says it is over, except one that scored, which stays a few seconds so its touchdown can be seen.
 */
export function liveDrives(feeds: EspnGameFeed[], teams: Set<string>, now: number): LiveDrive[] {
  const out: LiveDrive[] = [];
  for (const f of feeds) {
    if (f.state !== 'in') continue;
    const d = f.drives[f.drives.length - 1];
    if (!d || !teams.has(d.team)) continue;
    // timeouts, quarter ends and the two-minute warning aren't snaps
    const plays = f.plays.filter((p) => p.driveId === d.id && !/timeout|end of|end period|two-minute/i.test(p.type));
    const last = plays[plays.length - 1];
    // ESPN can keep calling a drive current after a punt or turnover until the other side's first snap
    const over = d.complete || (!!last && GAVE_UP.test(last.type));
    const scored = d.scored || (!!last && last.scoring);
    if (over && !(scored && last?.time != null && now - last.time <= SCORE_HOLD_MS)) continue;
    const result = over ? d.result ?? (scored ? (/field goal/i.test(last!.type) ? 'Field Goal' : 'Touchdown') : null) : null;
    out.push({
      key: d.id, eventId: f.eventId, team: d.team, from: d.from,
      spot: /touchdown/i.test(result ?? '') ? 0 : last?.end ?? d.from, down: over ? null : last?.down ?? null, result,
    });
  }
  return out;
}
