/**
 * When an NFL week is over. Sleeper marks a fantasy week scored (last_scored_leg) a day or two after
 * Monday night; ESPN's scoreboard knows the moment the last game ends, so the sync can count the week then.
 */

export const espnScoreboardUrl = (season: number, week: number): string =>
  `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${season}&seasontype=2&week=${week}`;

interface EspnEvent { status?: { type?: { state?: string; completed?: boolean } } }

/** Every game on ESPN's scoreboard for the week is final; a postponed game or an empty board is not. */
export function weekFinished(scoreboard: unknown): boolean {
  const events = (scoreboard as { events?: EspnEvent[] } | null)?.events;
  if (!Array.isArray(events) || events.length === 0) return false;
  return events.every((e) => e?.status?.type?.state === 'post' && e.status.type.completed !== false);
}

/** Sleeper's last scored week, or the week after it once that week's NFL games are all final. */
export async function scoredThrough(lastScoredLeg: number, finished: (week: number) => Promise<boolean>): Promise<number> {
  try {
    return (await finished(lastScoredLeg + 1)) ? lastScoredLeg + 1 : lastScoredLeg;
  } catch {
    return lastScoredLeg;
  }
}
