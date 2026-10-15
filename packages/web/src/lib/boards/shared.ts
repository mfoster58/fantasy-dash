import type { Draft, PlayerDirectory, PlayerId, PlayerSeasonLine, Season, Transaction, UserId } from '@fantasy-dash/core';
import { fmtPpg, fmtPts, fmtTag } from '../format';
import type { PlayerLine, PosFilter } from '../playerLines';
import type { XfpModel } from '../xfp';

export type Section = 'leaders' | 'career' | 'postseason' | 'extras';
export type Direction = 'desc' | 'asc';

export interface BoardRow {
  key: string;
  playerId: PlayerId;
  value: number;
  valueLabel: string;
  /** "2025 · Wk 7" for a single game; "3 seasons" for an all-time career row; "2025" when a season is chosen; the years list for a postseason row */
  meta: string;
  detail: string | null;
  userId: UserId | null;
  to: string | null;
}

export interface DraftValue { year: number; playerId: PlayerId; value: number; round: number; pickNo: number }
export interface SeasonTransactions { year: number; transactions: Transaction[] }

export interface BoardContext {
  /** already narrowed to the section's position and season */
  lines: PlayerLine[];
  players: PlayerDirectory;
  champions: Record<number, UserId | null>;
  lastPlaces: Record<number, UserId | null>;
  /** chosen season, or null for All-time */
  year: number | null;
  /** newest season in the data */
  currentYear: number;
  pos: PosFilter;
  /** every season; boards narrow with inYear */
  picks: DraftValue[];
  xfp: XfpModel | null;
  transactions: SeasonTransactions[];
  playerSeasons: Record<number, Record<PlayerId, PlayerSeasonLine>>;
  drafts: Record<number, Draft | null>;
}

/** One way of reading a board; the first mode is the default. */
export interface BoardMode {
  id: string;
  label: string;
  valueHeader: string;
}

export interface BoardDef {
  id: string;
  section: Section;
  title: string;
  definition: string;
  valueHeader: string;
  /** offers an Over/Under direction toggle */
  sortable?: boolean;
  /** offers a mode toggle; `compute` receives the chosen mode id */
  modes?: readonly BoardMode[];
  compute: (ctx: BoardContext, direction?: Direction, mode?: string) => BoardRow[];
}

export const MAX_ROWS = 25;
export const MIN_SEASON_GAMES = 3;
export const MIN_ALLTIME_GAMES = 12;
export const MIN_POST_GAMES = 3;
/** played games needed before a per-game reading ranks a player */
export const minGames = (ctx: BoardContext): number => (ctx.year === null ? MIN_ALLTIME_GAMES : MIN_SEASON_GAMES);
export const inYear = (ctx: BoardContext, year: number): boolean => ctx.year === null || year === ctx.year;

export const pointsModes = (): readonly BoardMode[] => [
  { id: 'total', label: 'Total', valueHeader: 'Pts' },
  { id: 'ppg', label: 'PPG', valueHeader: 'PPG' },
];
export const TOUCH_MODES: readonly BoardMode[] = [{ id: 'both', label: 'Both', valueHeader: 'Touches' }, { id: 'rec', label: 'Rec', valueHeader: 'Rec' }, { id: 'car', label: 'Car', valueHeader: 'Car' }];

export function championsOf(seasons: Season[]): Record<number, UserId | null> {
  return Object.fromEntries(seasons.map((s) => [s.year, s.honors.champion]));
}

export function lastPlacesOf(seasons: Season[]): Record<number, UserId | null> {
  return Object.fromEntries(seasons.map((s) => [s.year, s.honors.lastPlace]));
}

export function draftValuesOf(seasons: Season[]): DraftValue[] {
  const out: DraftValue[] = [];
  for (const s of seasons) {
    for (const p of s.draft?.picks ?? []) if (p.value !== null) out.push({ year: s.year, playerId: p.playerId, value: p.value, round: p.round, pickNo: p.pickNo });
  }
  return out;
}

export const when = (l: { year: number; week: number; tag: PlayerLine['tag'] }) => `${l.year} · Wk ${l.week}${l.tag ? ` · ${fmtTag(l.tag)}` : ''}`;
export const boxScore = (l: PlayerLine) => `/scores/${l.year}/${l.week}/${l.matchupId}`;
export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const distinctYears = (lines: PlayerLine[]) => [...new Set(lines.map((l) => l.year))].sort((a, b) => a - b);
/** "2023, 2025": kept for postseason boards, where the years are the story */
export const yearsOf = (lines: PlayerLine[]) => distinctYears(lines).join(', ');
/** "3 seasons" */
export const seasonsOf = (lines: PlayerLine[]) => plural(distinctYears(lines).length, 'season');
/** "2025" when a season is chosen, else "N seasons" */
export const metaOf = (ctx: BoardContext) => (ls: PlayerLine[]): string => (ctx.year === null ? seasonsOf(ls) : String(ctx.year));
/** "300 pass · 12 rush", dropping zero parts */
export const parts = (ps: [number, string][]) => ps.filter(([v]) => v > 0).map(([v, w]) => `${v} ${w}`).join(' · ') || null;
export const round2 = (n: number) => Math.round(n * 100) / 100;
export const round1 = (n: number) => Math.round(n * 10) / 10;
export const intLabel = (v: number) => String(v);
export const fmt1 = (v: number) => v.toFixed(1);
export const KICKING_DEF = new Set(['K', 'DEF']);
export const skillOnly = (ls: PlayerLine[]) => ls.filter((l) => !KICKING_DEF.has(l.position));
export const matchesPos = (position: string, pos: PosFilter) =>
  pos === 'All' ? true : pos === 'FLEX' ? ['RB', 'WR', 'TE'].includes(position) : position === pos;

/** Sort by value (desc by default), newest (year, week) desc, playerId asc, then cap at MAX_ROWS. */
export function rank<T extends { value: number; latestYear: number; latestWeek: number; playerId: string }>(items: T[], direction: Direction = 'desc'): T[] {
  const sign = direction === 'asc' ? -1 : 1;
  return [...items]
    .sort((x, y) => sign * (y.value - x.value) || y.latestYear - x.latestYear || y.latestWeek - x.latestWeek || (x.playerId < y.playerId ? -1 : x.playerId > y.playerId ? 1 : 0))
    .slice(0, MAX_ROWS);
}

/** Group lines by a key, remembering the newest line in each group. */
export function groupBy(lines: PlayerLine[], keyOf: (l: PlayerLine) => string): Map<string, { lines: PlayerLine[]; latestYear: number; latestWeek: number }> {
  const groups = new Map<string, { lines: PlayerLine[]; latestYear: number; latestWeek: number }>();
  for (const l of lines) {
    const k = keyOf(l);
    const g = groups.get(k) ?? { lines: [], latestYear: 0, latestWeek: 0 };
    g.lines.push(l);
    if (l.year > g.latestYear || (l.year === g.latestYear && l.week > g.latestWeek)) { g.latestYear = l.year; g.latestWeek = l.week; }
    groups.set(k, g);
  }
  return groups;
}

/** One row per line (a "moment"). */
export function momentBoard(lines: PlayerLine[], value: (l: PlayerLine) => number, label: (v: number) => string): BoardRow[] {
  const items = lines.map((l) => ({ ...l, value: value(l), latestYear: l.year, latestWeek: l.week }));
  return rank(items).map((l) => ({
    key: `${l.gameId}-${l.playerId}`, playerId: l.playerId, value: l.value, valueLabel: label(l.value),
    meta: when(l), detail: null, userId: l.userId, to: boxScore(l),
  }));
}

/** One row per player, aggregated over every line given. `value` may return null to drop a player. */
export function careerBoard(lines: PlayerLine[], value: (ls: PlayerLine[]) => number | null, label: (v: number) => string, detail: (ls: PlayerLine[]) => string | null, meta: (ls: PlayerLine[]) => string = seasonsOf): BoardRow[] {
  const items = [...groupBy(lines, (l) => l.playerId).entries()]
    .map(([playerId, g]) => ({ playerId, value: value(g.lines), latestYear: g.latestYear, latestWeek: g.latestWeek, lines: g.lines }))
    .filter((i): i is typeof i & { value: number } => i.value !== null && i.value > 0);
  return rank(items).map((i) => ({
    key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: label(i.value),
    meta: meta(i.lines), detail: detail(i.lines), userId: null, to: null,
  }));
}

export const sum = (ls: PlayerLine[], f: (l: PlayerLine) => number) => round2(ls.reduce((s, l) => s + f(l), 0));
export const started = (ctx: BoardContext) => ctx.lines.filter((l) => l.started);

/** Total points or, in ppg mode, points per played start over players with at least `minGames` played starts (unplayed starts count as neither). */
export function pointsBoard(lines: PlayerLine[], mode: string | undefined, minGames: number, meta?: (ls: PlayerLine[]) => string): BoardRow[] {
  if (mode === 'ppg') {
    const played = lines.filter((l) => l.played);
    return careerBoard(played, (ls) => (ls.length >= minGames ? round2(sum(ls, (l) => l.points) / ls.length) : null), fmtPpg, (ls) => plural(ls.length, 'game'), meta);
  }
  return careerBoard(lines, (ls) => sum(ls, (l) => l.points), fmtPts, (ls) => plural(ls.length, 'start'), meta);
}
