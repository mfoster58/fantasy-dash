import type { History, PlayerId, Season, SeasonStatus, StandingRow, UserId } from '@fantasy-dash/core';
import type { FinishKind } from '../components/Icons';
import { finalPlacement, finishOf, type Finish } from './teamProfile';

/** one point on a row's sparkline */
export interface SparkPoint { label: string; value: number; league: number; result?: 'W' | 'L' | 'T' }

export interface TeamRow {
  row: StandingRow; userId: UserId; teamName: string; managerName: string; avatar: string | null;
  finish: Finish; inSeason: boolean;
  /** 1 = most points for; 1 = fewest points against */
  pfRank: number; paRank: number;
  /** weekly points against the league average, played weeks only */
  spark: SparkPoint[];
  /** most points while started this season */
  topScorer: { playerId: PlayerId; points: number } | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const rankBy = (rows: StandingRow[], key: (r: StandingRow) => number, better: (a: number, b: number) => boolean) =>
  (r: StandingRow) => rows.filter((o) => better(key(o), key(r))).length + 1;

/** One row per team in standings order: the standings line, final finish, ranks, a weekly sparkline and the top scorer. */
export function teamRows(season: Season): TeamRow[] {
  const placement = finalPlacement(season);
  const pfRank = rankBy(season.standings, (r) => r.pf, (a, b) => a > b);
  const paRank = rankBy(season.standings, (r) => r.pa, (a, b) => a < b);
  const played = season.weeks.filter((w) => w.played);
  return season.standings.map((r) => {
    const m = season.managers[r.userId];
    const spark: SparkPoint[] = [];
    const scorers = new Map<PlayerId, number>();
    for (const wk of played) {
      const all = wk.games.flatMap((g) => g.sides.map((s) => s.points));
      const league = all.length ? round2(all.reduce((t, p) => t + p, 0) / all.length) : 0;
      for (const g of wk.games) {
        const i = g.sides.findIndex((s) => s.userId === r.userId);
        if (i < 0) continue;
        const me = g.sides[i], opp = g.sides[1 - i];
        spark.push({ label: `Week ${wk.week}`, value: me.points, league, result: me.points > opp.points ? 'W' : me.points < opp.points ? 'L' : 'T' });
        for (const e of me.starters) if (e.player) scorers.set(e.player.playerId, round2((scorers.get(e.player.playerId) ?? 0) + e.player.points));
      }
    }
    const top = [...scorers.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
    return {
      row: r, userId: r.userId, teamName: m?.teamName ?? m?.displayName ?? r.userId, managerName: m?.displayName ?? r.userId, avatar: m?.avatar ?? null,
      finish: finishOf(season, r.userId, placement), inSeason: season.status !== 'complete',
      pfRank: pfRank(r), paRank: paRank(r), spark, topScorer: top ? { playerId: top[0], points: top[1] } : null,
    };
  });
}

export interface ManagerSeasonChip { year: number; status: SeasonStatus; teamName: string; rank: number; finish: string; icon: FinishKind | null }
export interface ManagerRow {
  userId: UserId; rank: number; name: string; avatar: string | null;
  /** the most recent team name */
  teamName: string;
  w: number; l: number; t: number; winPct: number; ppg: number; titles: number; weeklyHighs: number;
  /** complete seasons only */
  playoffApps: number; completeSeasons: number;
  /** oldest first */
  seasons: ManagerSeasonChip[];
  /** PPG by season against the league average, oldest first */
  spark: SparkPoint[];
}

/** One row per manager in all-time order: career line, a chip per season with the finish, and a PPG sparkline. */
export function managerRows(seasons: Season[], history: History): ManagerRow[] {
  const ordered = [...seasons].sort((a, b) => a.year - b.year);
  const placements = new Map(ordered.map((s) => [s.year, finalPlacement(s)]));
  return history.allTime.map((r) => {
    const m = history.managers[r.userId];
    const mine = ordered.filter((s) => s.standings.some((x) => x.userId === r.userId));
    const chips: ManagerSeasonChip[] = mine.map((s) => {
      const f = finishOf(s, r.userId, placements.get(s.year));
      const sm = s.managers[r.userId];
      return { year: s.year, status: s.status, teamName: sm?.teamName ?? sm?.displayName ?? r.userId, rank: s.standings.find((x) => x.userId === r.userId)!.rank, finish: f.label, icon: f.icon };
    });
    const spark: SparkPoint[] = mine.map((s) => {
      const league = s.standings.reduce((t, x) => t + x.ppg, 0) / Math.max(1, s.standings.length);
      return { label: String(s.year), value: s.standings.find((x) => x.userId === r.userId)!.ppg, league: round2(league) };
    });
    const complete = mine.filter((s) => s.status === 'complete');
    return {
      userId: r.userId, rank: r.rank, name: m?.displayName ?? r.userId, avatar: m?.avatar ?? null,
      teamName: chips.at(-1)?.teamName ?? '',
      w: r.w, l: r.l, t: r.t, winPct: r.winPct, ppg: r.ppg, titles: r.titles, weeklyHighs: r.weeklyHighs,
      playoffApps: complete.filter((s) => s.brackets.winners.some((b) => b.home === r.userId || b.away === r.userId)).length, completeSeasons: complete.length,
      seasons: chips, spark,
    };
  });
}
