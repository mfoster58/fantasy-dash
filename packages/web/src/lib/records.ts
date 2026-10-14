import type { StandingRow, UserId } from '@fantasy-dash/core';
import { fmtPpg, fmtPts, fmtRecord, fmtWinPct } from './format';

export interface SeasonRecord { key: string; label: string; userId: UserId; value: string; definition: string }

function leader(rows: StandingRow[], score: (r: StandingRow) => number): StandingRow {
  return rows.reduce((best, r) => {
    const a = score(r); const b = score(best);
    return a > b || (a === b && r.pf > best.pf) ? r : best;
  });
}

/** The five season records shown on the season review, derived from regular-season standings. */
export function seasonRecords(rows: StandingRow[]): SeasonRecord[] {
  if (rows.length === 0) return [];
  const mostPoints = leader(rows, (r) => r.pf);
  const bestPpg = leader(rows, (r) => r.ppg);
  const bestRecord = leader(rows, (r) => r.winPct);
  const bestAllPlay = leader(rows, (r) => r.allPlay.pct);
  const mostWeeklyHighs = leader(rows, (r) => r.weeklyHighs);
  return [
    { key: 'mostPoints', label: 'Most points', userId: mostPoints.userId, value: fmtPts(mostPoints.pf), definition: 'Highest regular-season points for.' },
    { key: 'bestPpg', label: 'Best PPG', userId: bestPpg.userId, value: fmtPpg(bestPpg.ppg), definition: 'Highest regular-season points per game.' },
    { key: 'bestRecord', label: 'Best record', userId: bestRecord.userId, value: fmtRecord(bestRecord), definition: 'Best regular-season win percentage; points for breaks ties.' },
    { key: 'bestAllPlay', label: 'Best all-play', userId: bestAllPlay.userId, value: `${bestAllPlay.allPlay.w}-${bestAllPlay.allPlay.l}${bestAllPlay.allPlay.t ? `-${bestAllPlay.allPlay.t}` : ''} (${fmtWinPct(bestAllPlay.allPlay.pct)})`, definition: 'Best record against every other team each week.' },
    { key: 'mostWeeklyHighs', label: 'Most weekly highs', userId: mostWeeklyHighs.userId, value: String(mostWeeklyHighs.weeklyHighs), definition: "Most weeks with the league's top score." },
  ];
}
