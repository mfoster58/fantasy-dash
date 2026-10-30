import { GAVE_UP, isSnap } from './drives';
import type { EspnGameFeed } from './espnGame';
import type { FieldPlay } from './readPlays';

/** one drive a lineup's players were in, for the chips under its field */
export interface DriveSummary {
  key: string;
  eventId: string;
  /** Sleeper code of the team with the ball */
  team: string;
  /** the quarter of its first snap */
  period: number;
  snaps: number;
  yards: number;
  /** "Touchdown", "Punt", ...; null while it goes on */
  result: string | null;
  live: boolean;
  /** the players' points on it */
  pts: number;
  /** yards to the end zone at its first snap, and where it got to */
  from: number;
  spot: number;
  /** its first snap, for the order */
  time: number;
}

/**
 * The drives a lineup's players were in, newest first. Yards run from the first snap to the spot of the last snap
 * that kept the ball (the spot a punt or a missed kick was tried from), or to the end zone.
 */
export function driveList(feeds: EspnGameFeed[], plays: FieldPlay[]): DriveSummary[] {
  const out: DriveSummary[] = [];
  for (const f of feeds) {
    f.drives.forEach((d, i) => {
      const mine = plays.filter((p) => p.eventId === f.eventId && p.driveId === d.id);
      const snaps = f.plays.filter((p) => p.driveId === d.id && isSnap(p));
      if (!mine.length || !snaps.length) return;
      const last = snaps[snaps.length - 1];
      const going = !d.complete && i === f.drives.length - 1 && !GAVE_UP.test(last.type) && f.state === 'in';
      const scored = d.scored || snaps.some((p) => p.scoring);
      const result = going ? null : d.result ?? (scored ? (/field goal/i.test(last.type) ? 'Field Goal' : 'Touchdown') : last.type);
      const kept = [...snaps].reverse().find((p) => !GAVE_UP.test(p.type));
      const from = snaps[0].start ?? 0;
      const spot = /touchdown/i.test(result ?? '') ? 0 : going ? last.end ?? from : (GAVE_UP.test(last.type) ? last.start : kept?.end ?? last.start) ?? from;
      out.push({
        key: d.id, eventId: f.eventId, team: d.team, period: snaps[0].period, snaps: snaps.length, yards: Math.max(0, from - spot),
        result, live: going, pts: Math.round(mine.reduce((n, p) => n + p.pts, 0) * 100) / 100, from, spot, time: snaps[0].time ?? 0,
      });
    });
  }
  return out.sort((a, b) => b.time - a.time);
}
