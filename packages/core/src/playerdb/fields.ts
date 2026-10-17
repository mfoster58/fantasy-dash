import type { PlayerWeekKey } from './types';

export type FieldMap = Readonly<Record<string, PlayerWeekKey>>;
export type WeekFields = Partial<Record<PlayerWeekKey, number>>;

export const round3 = (n: number): number => Math.round((n + Number.EPSILON) * 1000) / 1000;

/** A CSV cell as a number; blank, NA and unparsable cells are null. */
export function numberOf(s: string | undefined): number | null {
  if (s === undefined) return null;
  const t = s.trim();
  if (t === '' || t === 'NA' || t === 'NaN' || t === 'NULL') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Rename the numeric columns in `fields`; absent or blank columns are left out. */
export function mapFields(row: Record<string, string>, fields: FieldMap): WeekFields {
  const out: WeekFields = {};
  for (const [col, key] of Object.entries(fields)) {
    const v = numberOf(row[col]);
    if (v !== null) out[key] = round3(v);
  }
  return out;
}

export const weekKey = (id: string, week: number | string): string => `${id}|${week}`;

/** Index weekly CSV rows by `${idCol}|${week}`, keeping rows `accept` allows; duplicate keys merge, later values winning. */
export function indexWeekly(rows: Iterable<Record<string, string>>, idCol: string, fields: FieldMap, accept: (row: Record<string, string>) => boolean): Map<string, WeekFields> {
  const out = new Map<string, WeekFields>();
  for (const row of rows) {
    const id = row[idCol];
    const week = numberOf(row.week);
    if (!id || week === null || week < 1 || week > 18 || !accept(row)) continue;
    const key = weekKey(id, week);
    out.set(key, { ...(out.get(key) ?? {}), ...mapFields(row, fields) });
  }
  return out;
}
