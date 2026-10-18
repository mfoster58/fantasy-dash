import type { PlayerId, Season, UserId } from '@fantasy-dash/core';
import type { PlayerLine } from '../playerLines';

export interface SeasonRow { year: number; managers: UserId[]; starts: number; rostered: number; benchPts: number; pts: number; ppg: number | null; best: number | null; posRank: number | null; overallRank: number | null; w: number; l: number; t: number; playoffPts: number | null; title: boolean }
export type BestKey = 'starts' | 'pts' | 'ppg' | 'best' | 'posRank' | 'overallRank' | 'playoffPts';
export interface SeasonTable { rows: SeasonRow[]; career: Omit<SeasonRow, 'year' | 'managers' | 'posRank' | 'overallRank' | 'title'> & { managers: number }; best: Partial<Record<BestKey, number>> }
export interface Summary { ptsStarted: number; perStart: number | null; starts: number; rostered: number; best: number | null; w: number; l: number; t: number; managers: number; titles: number[] }

const LOWER_BETTER: ReadonlySet<BestKey> = new Set(['posRank', 'overallRank']);

/** rank by season points among every player that season; ties share the better rank */
function overallRank(season: Season, id: PlayerId): number | null {
  const mine = season.playerSeasons[id]?.points;
  if (mine === undefined) return null;
  return Object.values(season.playerSeasons).filter((p) => p.points > mine).length + 1;
}

function tally(lines: PlayerLine[]) {
  const started = lines.filter((l) => l.started);
  const po = started.filter((l) => l.postseason);
  const pts = started.reduce((n, l) => n + l.points, 0);
  return {
    starts: started.length, rostered: lines.length,
    benchPts: lines.filter((l) => !l.started).reduce((n, l) => n + l.points, 0),
    pts, ppg: started.length ? pts / started.length : null,
    best: lines.length ? Math.max(...lines.map((l) => l.points)) : null,
    w: started.filter((l) => l.result === 'W').length, l: started.filter((l) => l.result === 'L').length, t: started.filter((l) => l.result === 'T').length,
    playoffPts: po.length ? po.reduce((n, l) => n + l.points, 0) : null,
  };
}

/** One row per league season he was rostered in (consolation games excluded), a career row, and each column's best when there are two or more seasons. */
export function seasonTable(lines: PlayerLine[], seasons: Season[], id: PlayerId): SeasonTable {
  const counted = lines.filter((l) => !l.consolation);
  const rows: SeasonRow[] = [];
  for (const s of [...seasons].sort((a, b) => a.year - b.year)) {
    const mine = counted.filter((l) => l.year === s.year).sort((a, b) => a.week - b.week);
    if (!mine.length) continue;
    const managers = [...new Set(mine.map((l) => l.userId))];
    const champ = s.honors.champion;
    rows.push({
      year: s.year, managers, ...tally(mine),
      posRank: s.playerSeasons[id]?.posRank ?? null, overallRank: overallRank(s, id),
      title: champ !== null && mine.some((l) => l.postseason && l.userId === champ),
    });
  }
  const best: SeasonTable['best'] = {};
  if (rows.length > 1) {
    for (const k of ['starts', 'pts', 'ppg', 'best', 'posRank', 'overallRank', 'playoffPts'] as BestKey[]) {
      const vals = rows.map((r) => r[k]).filter((v): v is number => v !== null);
      if (vals.length) best[k] = LOWER_BETTER.has(k) ? Math.min(...vals) : Math.max(...vals);
    }
  }
  return { rows, career: { managers: new Set(rows.flatMap((r) => r.managers)).size, ...tally(counted) }, best };
}

export function summaryOf(table: SeasonTable): Summary {
  const c = table.career;
  return { ptsStarted: c.pts, perStart: c.ppg, starts: c.starts, rostered: c.rostered, best: c.best, w: c.w, l: c.l, t: c.t, managers: c.managers, titles: table.rows.filter((r) => r.title).map((r) => r.year) };
}
