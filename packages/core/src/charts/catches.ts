/**
 * Where each catch was made: nflverse's air yards for every completed pass, so the live field can redraw a finished
 * game's catches at their real spots. ESPN's play-by-play (what the field reads) gives no catch spot, so the two are
 * matched by the team with the ball, the quarter and the game clock at the snap, which both sources record.
 */
import { z } from 'zod';
import { normalizeTeam } from '../playerdb/crosswalk';

export const CatchSpotsSchema = z.object({
  year: z.number(),
  builtAt: z.string(),
  /** week → "CLE|1|7:13" → air yards */
  weeks: z.record(z.record(z.number())),
});
export type CatchSpots = z.infer<typeof CatchSpotsSchema>;

/** "CLE|1|7:13": Sleeper's team code, the quarter, and the clock as ESPN writes it ("7:13", not "07:13") */
export function catchKey(team: string, period: number, clock: string): string {
  const [m, s] = clock.split(':');
  return `${normalizeTeam(team)}|${period}|${Number(m)}:${s}`;
}

type Row = Record<string, string>;
const present = (v: string | undefined): v is string => v !== undefined && v !== '' && v !== 'NA';

export function buildCatchSpots(pbp: Iterable<Row>, year: number, builtAt: string): CatchSpots {
  const weeks: CatchSpots['weeks'] = {};
  for (const r of pbp) {
    if (r.season_type !== 'REG' || r.complete_pass !== '1' || !present(r.air_yards) || !present(r.posteam) || !present(r.time) || !present(r.week)) continue;
    const air = Number(r.air_yards);
    if (!Number.isFinite(air)) continue;
    (weeks[String(Number(r.week))] ??= {})[catchKey(r.posteam, Number(r.qtr), r.time)] = air;
  }
  return { year, builtAt, weeks };
}
