import type { PlayerDirectory, PlayerId, Season, UserId } from '@fantasy-dash/core';
import { fmtPpg, fmtPts, fmtTag } from './format';
import type { PlayerLine } from './playerLines';

export type Section = 'leaders' | 'allTime' | 'postseason' | 'extras';

export interface BoardRow {
  key: string;
  playerId: PlayerId;
  value: number;
  valueLabel: string;
  /** "2025 · Wk 7" for a single game, the years list for a career row */
  meta: string;
  detail: string | null;
  userId: UserId | null;
  to: string | null;
}

export interface BoardContext {
  lines: PlayerLine[];
  players: PlayerDirectory;
  champions: Record<number, UserId | null>;
  currentYear: number;
}

export interface BoardDef {
  id: string;
  section: Section;
  title: string;
  definition: string;
  valueHeader: string;
  compute: (ctx: BoardContext) => BoardRow[];
}

export const MAX_ROWS = 25;
const MIN_PPG_GAMES = 12;

export function championsOf(seasons: Season[]): Record<number, UserId | null> {
  return Object.fromEntries(seasons.map((s) => [s.year, s.honors.champion]));
}

const when = (l: { year: number; week: number; tag: PlayerLine['tag'] }) => `${l.year} · Wk ${l.week}${l.tag ? ` · ${fmtTag(l.tag)}` : ''}`;
const boxScore = (l: PlayerLine) => `/scores/${l.year}/${l.week}/${l.matchupId}`;
const yearsOf = (lines: PlayerLine[]) => [...new Set(lines.map((l) => l.year))].sort((a, b) => a - b).join(', ');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Sort by value desc, newest (year, week) desc, playerId asc, then cap at MAX_ROWS. */
function rank<T extends { value: number; latestYear: number; latestWeek: number; playerId: string }>(items: T[], asc = false): T[] {
  return [...items]
    .sort((x, y) => (asc ? x.value - y.value : y.value - x.value) || y.latestYear - x.latestYear || y.latestWeek - x.latestWeek || (x.playerId < y.playerId ? -1 : x.playerId > y.playerId ? 1 : 0))
    .slice(0, MAX_ROWS);
}

/** Group lines by a key, remembering the newest line in each group. */
function groupBy(lines: PlayerLine[], keyOf: (l: PlayerLine) => string): Map<string, { lines: PlayerLine[]; latestYear: number; latestWeek: number }> {
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
function momentBoard(lines: PlayerLine[], value: (l: PlayerLine) => number, label: (v: number) => string): BoardRow[] {
  const items = lines.map((l) => ({ ...l, value: value(l), latestYear: l.year, latestWeek: l.week }));
  return rank(items).map((l) => ({
    key: `${l.gameId}-${l.playerId}`, playerId: l.playerId, value: l.value, valueLabel: label(l.value),
    meta: when(l), detail: null, userId: l.userId, to: boxScore(l),
  }));
}

/** One row per player, aggregated over every season. */
function careerBoard(lines: PlayerLine[], value: (ls: PlayerLine[]) => number, label: (v: number) => string, detail: (ls: PlayerLine[]) => string | null): BoardRow[] {
  const items = [...groupBy(lines, (l) => l.playerId).entries()].map(([playerId, g]) => ({ playerId, value: value(g.lines), latestYear: g.latestYear, latestWeek: g.latestWeek, lines: g.lines }));
  return rank(items.filter((i) => i.value > 0)).map((i) => ({
    key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: label(i.value),
    meta: yearsOf(i.lines), detail: detail(i.lines), userId: null, to: null,
  }));
}

const sum = (ls: PlayerLine[], f: (l: PlayerLine) => number) => round2(ls.reduce((s, l) => s + f(l), 0));
const started = (ctx: BoardContext) => ctx.lines.filter((l) => l.started);

export const bestWeek = (ctx: BoardContext): BoardRow[] => momentBoard(started(ctx), (l) => l.points, fmtPts);

export const bestSeason = (ctx: BoardContext): BoardRow[] => {
  const groups = groupBy(started(ctx), (l) => `${l.playerId}|${l.userId}|${l.year}`);
  const items = [...groups.entries()].map(([k, g]) => {
    const [playerId, userId, year] = k.split('|');
    return { playerId, userId, year: Number(year), value: sum(g.lines, (l) => l.points), starts: g.lines.length, latestYear: g.latestYear, latestWeek: g.latestWeek };
  });
  return rank(items).map((i) => ({
    key: `${i.playerId}-${i.userId}-${i.year}`, playerId: i.playerId, value: i.value, valueLabel: fmtPts(i.value),
    meta: String(i.year), detail: plural(i.starts, 'start'), userId: i.userId, to: `/scores/${i.year}`,
  }));
};

export const careerPoints = (ctx: BoardContext): BoardRow[] =>
  careerBoard(started(ctx), (ls) => sum(ls, (l) => l.points), fmtPts, (ls) => plural(ls.length, 'start'));

export const weeksStarted = (ctx: BoardContext): BoardRow[] =>
  careerBoard(started(ctx), (ls) => ls.length, String, (ls) => plural(ls.length, 'start'));

export const championshipRosters = (ctx: BoardContext): BoardRow[] => {
  const onChampion = ctx.lines.filter((l) => l.tag === 'Final' && ctx.champions[l.year] === l.userId);
  // one line per player per year, bench included
  const seen = new Set<string>();
  const unique = onChampion.filter((l) => { const k = `${l.playerId}|${l.year}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return careerBoard(unique, (ls) => ls.length, String, () => null);
};

export const benchBlunder = (ctx: BoardContext): BoardRow[] => momentBoard(ctx.lines.filter((l) => !l.started), (l) => l.points, fmtPts);

export const careerPpg = (ctx: BoardContext): BoardRow[] => {
  const played = ctx.lines.filter((l) => l.played);
  const items = [...groupBy(played, (l) => l.playerId).entries()]
    .filter(([, g]) => g.lines.length >= MIN_PPG_GAMES)
    .map(([playerId, g]) => ({ playerId, value: round2(sum(g.lines, (l) => l.points) / g.lines.length), games: g.lines.length, lines: g.lines, latestYear: g.latestYear, latestWeek: g.latestWeek }));
  return rank(items).map((i) => ({
    key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: fmtPpg(i.value),
    meta: yearsOf(i.lines), detail: plural(i.games, 'game'), userId: null, to: null,
  }));
};

export const BOARDS: BoardDef[] = [
  { id: 'bestWeek', section: 'allTime', title: 'Best week by a starter', definition: 'Most points by a player in one week while in a starting lineup.', valueHeader: 'Pts', compute: bestWeek },
  { id: 'bestSeason', section: 'allTime', title: 'Best season by a starter', definition: 'Most points a player scored for one manager in one season while started.', valueHeader: 'Pts', compute: bestSeason },
  { id: 'careerPoints', section: 'allTime', title: 'Most career points started', definition: 'Total points scored while in a starting lineup, every season and manager.', valueHeader: 'Pts', compute: careerPoints },
  { id: 'weeksStarted', section: 'allTime', title: 'Most weeks started', definition: 'Weeks in a starting lineup across every season.', valueHeader: 'Starts', compute: weeksStarted },
  { id: 'championshipRosters', section: 'allTime', title: 'Most championship rosters', definition: "Seasons on the champion's roster, starters and bench, in the championship game.", valueHeader: 'Titles', compute: championshipRosters },
  { id: 'benchBlunder', section: 'allTime', title: 'Biggest bench blunder', definition: 'Most points by a player left on the bench in one week.', valueHeader: 'Pts', compute: benchBlunder },
  { id: 'careerPpg', section: 'allTime', title: 'Career PPG', definition: `Points per game over weeks the player actually played, started or benched. At least ${MIN_PPG_GAMES} games.`, valueHeader: 'PPG', compute: careerPpg },
];
