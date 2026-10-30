import type { EspnGameFeed, EspnPlay } from './espnGame';

/** play types after which the drive is over: the ball changed hands or points went up */
const GAVE_UP = /punt|interception|fumble recovery \(opponent\)|field goal|touchdown|safety|turnover on downs|blocked/i;
/** a snap: not a kickoff (ESPN files it at the start of the receiving team's drive), a timeout, a quarter's end or the two-minute warning */
const isSnap = (p: EspnPlay) => !/kickoff|timeout|end of|end period|two-minute/i.test(p.type);

export interface LiveDrive {
  /** ESPN's drive id */
  key: string;
  eventId: string;
  /** Sleeper code of the team with the ball */
  team: string;
  /** yards to the end zone at its first snap, and where the ball is now */
  from: number | null;
  spot: number | null;
  /** "2nd & 6 at TEN 20" while it goes on */
  down: string | null;
  /** how it ended ("Touchdown", "Punt", ...); null while it goes on */
  result: string | null;
}

/**
 * The drive on the field in each game still going, for the given teams. A drive stays until the other team's first
 * snap, so a touchdown (or a punt) stays up through the extra point, the break and the kickoff.
 */
export function liveDrives(feeds: EspnGameFeed[], teams: Set<string>): LiveDrive[] {
  const out: LiveDrive[] = [];
  for (const f of feeds) {
    if (f.state !== 'in') continue;
    // the latest drive with a snap: one that has only had its kickoff hasn't started
    let k = f.drives.length - 1;
    const snaps = (i: number) => f.plays.filter((p) => p.driveId === f.drives[i].id && isSnap(p));
    while (k >= 0 && !snaps(k).length) k--;
    const d = f.drives[k];
    if (!d || !teams.has(d.team)) continue;
    const plays = snaps(k);
    const last = plays[plays.length - 1];
    const over = d.complete || k < f.drives.length - 1 || GAVE_UP.test(last.type);
    const scored = d.scored || plays.some((p) => p.scoring);
    const result = !over ? null : d.result ?? (scored ? (/field goal/i.test(last.type) ? 'Field Goal' : 'Touchdown') : last.type);
    out.push({
      key: d.id, eventId: f.eventId, team: d.team, from: plays[0].start,
      spot: /touchdown/i.test(result ?? '') ? 0 : last.end, down: over ? null : last.down, result,
    });
  }
  return out;
}
