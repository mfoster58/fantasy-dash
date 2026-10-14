import type { StandingRow, UserId, Week } from './types';
import { round2, round4 } from './scoring';

export type Result = 'W' | 'L' | 'T';

export function isRegularSeason(week: number, playoffWeekStart: number): boolean {
  return week < playoffWeekStart;
}

/** 'W3' / 'L2' for the trailing run; '-' when empty or the last game was a tie. */
export function computeStreak(results: Result[]): string {
  if (results.length === 0) return '-';
  const last = results[results.length - 1];
  if (last === 'T') return '-';
  let n = 0;
  for (let i = results.length - 1; i >= 0 && results[i] === last; i--) n++;
  return `${last}${n}`;
}

interface Acc {
  w: number; l: number; t: number;
  pf: number; pa: number; max: number; games: number;
  results: Result[];
  ap: { w: number; l: number; t: number };
  highs: number;
}

export function computeStandings(
  weeks: Week[],
  managerIds: UserId[],
  playoffWeekStart: number,
): StandingRow[] {
  const acc = new Map<UserId, Acc>(
    managerIds.map((id) => [id, { w: 0, l: 0, t: 0, pf: 0, pa: 0, max: 0, games: 0, results: [], ap: { w: 0, l: 0, t: 0 }, highs: 0 }]),
  );

  for (const wk of weeks) {
    if (!wk.played || !isRegularSeason(wk.week, playoffWeekStart)) continue;
    const scores = wk.games.flatMap((g) => g.sides.map((s) => ({ userId: s.userId, points: s.points })));

    for (const g of wk.games) {
      g.sides.forEach((side, i) => {
        const opp = g.sides[1 - i];
        const a = acc.get(side.userId);
        if (!a) return;
        a.pf += side.points;
        a.pa += opp.points;
        a.max += side.ceiling;
        a.games += 1;
        const r: Result = side.points > opp.points ? 'W' : side.points < opp.points ? 'L' : 'T';
        if (r === 'W') a.w += 1; else if (r === 'L') a.l += 1; else a.t += 1;
        a.results.push(r);
        for (const o of scores) {
          if (o.userId === side.userId) continue;
          if (side.points > o.points) a.ap.w += 1;
          else if (side.points < o.points) a.ap.l += 1;
          else a.ap.t += 1;
        }
      });
    }
    if (wk.highScore) {
      const a = acc.get(wk.highScore);
      if (a) a.highs += 1;
    }
  }

  const rows: StandingRow[] = [...acc.entries()].map(([userId, a]) => {
    const apTotal = a.ap.w + a.ap.l + a.ap.t;
    return {
      userId,
      rank: 0,
      w: a.w, l: a.l, t: a.t,
      winPct: a.games ? round4((a.w + a.t / 2) / a.games) : 0,
      pf: round2(a.pf),
      pa: round2(a.pa),
      ppg: a.games ? round2(a.pf / a.games) : 0,
      maxPoints: round2(a.max),
      efficiency: a.max ? round4(a.pf / a.max) : 0,
      streak: computeStreak(a.results),
      allPlay: { ...a.ap, pct: apTotal ? round4((a.ap.w + a.ap.t / 2) / apTotal) : 0 },
      weeklyHighs: a.highs,
    };
  });

  rows.sort((x, y) => y.w - x.w || y.pf - x.pf);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
