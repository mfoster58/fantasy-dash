import type { PlayerDb } from '@fantasy-dash/core';
import { aggregate, type Agg } from './aggregate';

/** Where one season sits in the merged week numbering: its weeks are offset+1..offset+weeks. */
export interface SeasonSpan { year: number; offset: number; weeks: number }

export interface MergedDb { db: PlayerDb; spans: SeasonSpan[] }

/**
 * Every season in one database, laid end to end oldest first, so week ranges and team-week lookups
 * stay unique. Routes are resolved per season: a season with real routes keeps them even when an
 * estimated one makes the merged database estimated.
 */
export function mergeSeasons(dbs: PlayerDb[]): MergedDb {
  const sorted = [...dbs].sort((a, b) => a.year - b.year);
  const routesReal = sorted.every((d) => d.routesReal);
  const spans: SeasonSpan[] = [];
  const db: PlayerDb = { year: sorted[sorted.length - 1]?.year ?? 0, throughWeek: 0, routesReal, builtAt: '', players: {}, teamWeeks: [], xfp: sorted[sorted.length - 1]?.xfp as PlayerDb['xfp'], rows: [] };
  for (const d of sorted) {
    const offset = db.throughWeek;
    spans.push({ year: d.year, offset, weeks: d.throughWeek });
    db.throughWeek += d.throughWeek;
    if (d.builtAt > db.builtAt) db.builtAt = d.builtAt;
    Object.assign(db.players, d.players);
    for (const t of d.teamWeeks) db.teamWeeks.push({ ...t, week: t.week + offset });
    for (const r of d.rows) db.rows.push({ ...r, week: r.week + offset, ...(!routesReal && d.routesReal ? { routesEst: r.routes } : {}) });
  }
  return { db, spans };
}

/** The season and week a merged week number came from. */
export function weekLabel(spans: SeasonSpan[], week: number): { year: number; week: number } {
  const s = spans.find((x) => week > x.offset && week <= x.offset + x.weeks) ?? spans[spans.length - 1];
  return { year: s?.year ?? 0, week: week - (s?.offset ?? 0) };
}

/** Every player over every season; sample minimums scale with the weeks of the seasons he has rows in. */
export function aggregateAllTime({ db, spans }: MergedDb): Agg[] {
  const out = aggregate(db, 1, Math.max(1, db.throughWeek));
  for (const a of out) {
    const seen = new Set(a.rows.map((r) => weekLabel(spans, r.week).year));
    a.weeks = spans.filter((s) => seen.has(s.year)).reduce((n, s) => n + s.weeks, 0);
  }
  return out;
}
