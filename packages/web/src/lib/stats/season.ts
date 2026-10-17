import type { Season, UserId } from '@fantasy-dash/core';
import { teamGamesOf, type TeamGame } from '../managerGames';
import { byWeek, regular } from './scope';

export interface RaceData { weeks: number[]; playoffTeams: number; series: { id: UserId; ranks: number[] }[] }
export interface FormCell { week: number; points: number; oppId: UserId; oppPoints: number; result: 'W' | 'L' | 'T'; matchupId: number; top: boolean }
export interface FormData { weeks: { week: number; playoff: boolean }[]; rows: { id: UserId; cells: (FormCell | null)[] }[]; playoffAt: number | null }
export interface CalendarCell { week: number; points: number; avg: number; delta: number }
export interface CalendarData { weeks: number[]; rows: { id: UserId; cells: (CalendarCell | null)[] }[] }
export interface FinishRow { id: UserId; top: number; middle: number; bottom: number; weeks: number }

const round2 = (n: number) => Math.round(n * 100) / 100;
const idsOf = (season: Season): UserId[] => season.standings.map((r) => r.userId);
const mine = (games: TeamGame[], id: UserId) => games.find((g) => g.userId === id) ?? null;

/** table position (wins, then points for) after each regular-season week */
export function standingsRace(season: Season): RaceData {
  const ids = idsOf(season);
  const weeks = byWeek(regular(teamGamesOf([season])));
  const wins = new Map<UserId, number>(ids.map((id) => [id, 0]));
  const pf = new Map<UserId, number>(ids.map((id) => [id, 0]));
  const ranks = new Map<UserId, number[]>(ids.map((id) => [id, []]));
  for (const w of weeks) {
    for (const g of w.games) { if (g.result === 'W') wins.set(g.userId, (wins.get(g.userId) ?? 0) + 1); pf.set(g.userId, (pf.get(g.userId) ?? 0) + g.points); }
    const order = [...ids].sort((x, y) => (wins.get(y)! - wins.get(x)!) || (pf.get(y)! - pf.get(x)!));
    order.forEach((id, i) => ranks.get(id)!.push(i + 1));
  }
  return { weeks: weeks.map((w) => w.week), playoffTeams: season.playoffTeams, series: ids.map((id) => ({ id, ranks: ranks.get(id)! })) };
}

/** one cell per manager per played week, regular and postseason, the week's top score marked */
export function formGuide(season: Season): FormData {
  const ids = idsOf(season);
  const weeks = byWeek(teamGamesOf([season]));
  const playoffAt = weeks.findIndex((w) => w.playoff);
  return {
    weeks: weeks.map((w) => ({ week: w.week, playoff: w.playoff })),
    playoffAt: playoffAt >= 0 ? playoffAt : null,
    rows: ids.map((id) => ({
      id,
      cells: weeks.map((w) => {
        const g = mine(w.games, id);
        if (!g) return null;
        const top = Math.max(...w.games.map((x) => x.points));
        return { week: w.week, points: g.points, oppId: g.opponentId, oppPoints: g.oppPoints, result: g.result, matchupId: g.matchupId, top: g.points === top };
      }),
    })),
  };
}

/** every regular-season score against that week's league average */
export function scoringCalendar(season: Season): CalendarData {
  const ids = idsOf(season);
  const weeks = byWeek(regular(teamGamesOf([season])));
  return {
    weeks: weeks.map((w) => w.week),
    rows: ids.map((id) => ({
      id,
      cells: weeks.map((w) => {
        const g = mine(w.games, id);
        if (!g) return null;
        const avg = round2(w.games.reduce((t, x) => t + x.points, 0) / w.games.length);
        return { week: w.week, points: g.points, avg, delta: round2(g.points - avg) };
      }),
    })),
  };
}

/** weeks finished in the top three scorers, the bottom three, and in between, over every regular-season week given */
export function weeklyFinishes(seasons: Season[]): FinishRow[] {
  const rows = new Map<UserId, FinishRow>();
  for (const w of byWeek(regular(teamGamesOf(seasons)))) {
    const n = w.games.length;
    for (const g of w.games) {
      const rank = 1 + w.games.filter((o) => o.points > g.points).length;
      const row = rows.get(g.userId) ?? { id: g.userId, top: 0, middle: 0, bottom: 0, weeks: 0 };
      row.weeks += 1;
      if (rank <= 3) row.top += 1; else if (rank > Math.max(3, n - 3)) row.bottom += 1; else row.middle += 1;
      rows.set(g.userId, row);
    }
  }
  return [...rows.values()].sort((x, y) => y.top - x.top || x.bottom - y.bottom || (x.id < y.id ? -1 : 1));
}
