import type { PlayerDirectory, PlayerId, Season, UserId } from '@fantasy-dash/core';
import { fmtPpg, fmtPts, fmtSigned, fmtTag } from './format';
import type { PlayerLine, PosFilter } from './playerLines';
import type { XfpModel } from './xfp';

export type Section = 'leaders' | 'allTime' | 'postseason' | 'extras';
export type Direction = 'desc' | 'asc';

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

export interface DraftValue { year: number; playerId: PlayerId; value: number }

export interface BoardContext {
  lines: PlayerLine[];
  players: PlayerDirectory;
  champions: Record<number, UserId | null>;
  currentYear: number;
  /** the section's position filter; lines are already narrowed, picks are not */
  pos: PosFilter;
  picks: DraftValue[];
  xfp: XfpModel | null;
}

export interface BoardDef {
  id: string;
  section: Section;
  title: string;
  definition: string;
  valueHeader: string;
  /** offers an Over/Under direction toggle */
  sortable?: boolean;
  compute: (ctx: BoardContext, direction?: Direction) => BoardRow[];
}

export const MAX_ROWS = 25;
const MIN_PPG_GAMES = 12;
const MIN_LEADER_GAMES = 3;

export function championsOf(seasons: Season[]): Record<number, UserId | null> {
  return Object.fromEntries(seasons.map((s) => [s.year, s.honors.champion]));
}

export function draftValuesOf(seasons: Season[]): DraftValue[] {
  const out: DraftValue[] = [];
  for (const s of seasons) {
    for (const p of s.draft?.picks ?? []) if (p.value !== null) out.push({ year: s.year, playerId: p.playerId, value: p.value });
  }
  return out;
}

const when = (l: { year: number; week: number; tag: PlayerLine['tag'] }) => `${l.year} · Wk ${l.week}${l.tag ? ` · ${fmtTag(l.tag)}` : ''}`;
const boxScore = (l: PlayerLine) => `/scores/${l.year}/${l.week}/${l.matchupId}`;
const yearsOf = (lines: PlayerLine[]) => [...new Set(lines.map((l) => l.year))].sort((a, b) => a - b).join(', ');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const round2 = (n: number) => Math.round(n * 100) / 100;
const round1 = (n: number) => Math.round(n * 10) / 10;
const intLabel = (v: number) => String(v);
const fmt1 = (v: number) => v.toFixed(1);
const KICKING_DEF = new Set(['K', 'DEF']);
const skillOnly = (ls: PlayerLine[]) => ls.filter((l) => !KICKING_DEF.has(l.position));
const matchesPos = (position: string, pos: PosFilter) =>
  pos === 'All' ? true : pos === 'FLEX' ? ['RB', 'WR', 'TE'].includes(position) : position === pos;

/** Sort by value (desc by default), newest (year, week) desc, playerId asc, then cap at MAX_ROWS. */
function rank<T extends { value: number; latestYear: number; latestWeek: number; playerId: string }>(items: T[], direction: Direction = 'desc'): T[] {
  const sign = direction === 'asc' ? -1 : 1;
  return [...items]
    .sort((x, y) => sign * (y.value - x.value) || y.latestYear - x.latestYear || y.latestWeek - x.latestWeek || (x.playerId < y.playerId ? -1 : x.playerId > y.playerId ? 1 : 0))
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

// All-time

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

// Postseason

const postseasonStarted = (ctx: BoardContext) => started(ctx).filter((l) => l.postseason);

export const postPoints = (ctx: BoardContext): BoardRow[] =>
  careerBoard(postseasonStarted(ctx), (ls) => sum(ls, (l) => l.points), fmtPts, (ls) => plural(ls.length, 'start'));
export const postStarts = (ctx: BoardContext): BoardRow[] =>
  careerBoard(postseasonStarted(ctx), (ls) => ls.length, intLabel, (ls) => `${fmtPts(sum(ls, (l) => l.points))} pts`);
export const postTouchdowns = (ctx: BoardContext): BoardRow[] =>
  careerBoard(postseasonStarted(ctx), (ls) => sum(ls, (l) => l.touchdowns), intLabel, (ls) => plural(ls.length, 'start'));
export const postYards = (ctx: BoardContext): BoardRow[] =>
  careerBoard(postseasonStarted(ctx), (ls) => sum(ls, (l) => l.yards), intLabel, (ls) => plural(ls.length, 'start'));
export const postReceptions = (ctx: BoardContext): BoardRow[] =>
  careerBoard(postseasonStarted(ctx), (ls) => sum(ls, (l) => l.receptions), intLabel, (ls) => plural(ls.length, 'start'));

export const championshipRosters = (ctx: BoardContext): BoardRow[] => {
  const onChampion = ctx.lines.filter((l) => l.tag === 'Final' && ctx.champions[l.year] === l.userId);
  // one line per player per year, bench included
  const seen = new Set<string>();
  const unique = onChampion.filter((l) => { const k = `${l.playerId}|${l.year}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return careerBoard(unique, (ls) => ls.length, String, () => null);
};

export const postToiletBowl = (ctx: BoardContext): BoardRow[] =>
  careerBoard(started(ctx).filter((l) => l.consolation), (ls) => ls.length, intLabel, (ls) => `${fmtPts(sum(ls, (l) => l.points))} pts`);

// Extras

export const boomStarts = (ctx: BoardContext): BoardRow[] =>
  careerBoard(started(ctx), (ls) => ls.filter((l) => l.points >= 30).length, intLabel, (ls) => plural(ls.length, 'start'));
export const dudStarts = (ctx: BoardContext): BoardRow[] =>
  careerBoard(skillOnly(started(ctx)), (ls) => ls.filter((l) => l.played && l.points < 5).length, intLabel, (ls) => plural(ls.length, 'start'));
export const journeyman = (ctx: BoardContext): BoardRow[] =>
  careerBoard(skillOnly(started(ctx)), (ls) => new Set(ls.map((l) => l.userId)).size, intLabel, (ls) => plural(ls.length, 'start'));

export const draftValue = (ctx: BoardContext): BoardRow[] => {
  const byPlayer = new Map<string, DraftValue[]>();
  for (const p of ctx.picks) {
    if (!matchesPos(ctx.players[p.playerId]?.position ?? '?', ctx.pos)) continue;
    byPlayer.set(p.playerId, [...(byPlayer.get(p.playerId) ?? []), p]);
  }
  const items = [...byPlayer.entries()].map(([playerId, picks]) => {
    const sorted = [...picks].sort((a, b) => a.year - b.year);
    return {
      playerId, value: round1(sorted.reduce((s, p) => s + p.value, 0)), picks: sorted,
      latestYear: sorted[sorted.length - 1].year, latestWeek: 0,
    };
  });
  return rank(items).map((i) => ({
    key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: fmtSigned(i.value, 1),
    meta: i.picks.map((p) => p.year).join(', '), detail: i.picks.map((p) => `${p.year} ${fmtSigned(p.value, 1)}`).join(' · '), userId: null, to: null,
  }));
};

// League leaders (selected season)

interface LeaderItem { value: number; detail: string | null }

/** Selected season, every rostered line, manager = whoever rostered the player most recently. `build` returns null to drop a player. */
function leaderBoard(ctx: BoardContext, build: (ls: PlayerLine[]) => LeaderItem | null, label: (v: number) => string, direction: Direction = 'desc'): BoardRow[] {
  const current = ctx.lines.filter((l) => l.year === ctx.currentYear);
  const items: { playerId: string; value: number; detail: string | null; userId: UserId; latestYear: number; latestWeek: number }[] = [];
  for (const [playerId, g] of groupBy(current, (l) => l.playerId)) {
    const built = build(g.lines);
    if (!built) continue;
    const latest = g.lines.reduce((a, b) => (b.week > a.week ? b : a));
    items.push({ playerId, value: built.value, detail: built.detail, userId: latest.userId, latestYear: g.latestYear, latestWeek: g.latestWeek });
  }
  return rank(items, direction).map((i) => ({
    key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: label(i.value),
    meta: String(ctx.currentYear), detail: i.detail, userId: i.userId, to: null,
  }));
}
const positive = (f: (ls: PlayerLine[]) => number) => (ls: PlayerLine[]): LeaderItem | null => { const v = f(ls); return v > 0 ? { value: v, detail: null } : null; };

export const leadPoints = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.points)), fmtPts);
export const leadYards = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.yards)), intLabel);
export const leadTouchdowns = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.touchdowns)), intLabel);
export const leadRushYards = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.rushYards)), intLabel);
export const leadRecYards = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.recYards)), intLabel);
export const leadPassYards = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.passYards)), intLabel);
export const leadRushTd = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.rushTd)), intLabel);
export const leadRecTd = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.recTd)), intLabel);
export const leadPassTd = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.passTd)), intLabel);

export const leadPpg = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, (ls) => {
  const played = ls.filter((l) => l.played);
  if (played.length < MIN_LEADER_GAMES) return null;
  return { value: round2(sum(played, (l) => l.points) / played.length), detail: plural(played.length, 'game') };
}, fmtPpg);

/** Played lines with a prediction, paired with it. */
function modelled(ctx: BoardContext, ls: PlayerLine[]): { line: PlayerLine; xfp: number }[] {
  if (!ctx.xfp) return [];
  const out: { line: PlayerLine; xfp: number }[] = [];
  for (const line of ls) {
    if (!line.played) continue;
    const xfp = ctx.xfp.predict(line);
    if (xfp !== null) out.push({ line, xfp });
  }
  return out;
}

export const leadFpoe = (ctx: BoardContext, direction: Direction = 'desc'): BoardRow[] => leaderBoard(ctx, (ls) => {
  const m = modelled(ctx, ls);
  if (m.length < MIN_LEADER_GAMES) return null;
  const expected = m.reduce((s, x) => s + x.xfp, 0);
  const actual = m.reduce((s, x) => s + x.line.points, 0);
  return { value: round1(actual - expected), detail: `xFP ${fmt1(expected)}` };
}, (v) => fmtSigned(v, 1), direction);

export const leadXfp = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, (ls) => {
  const m = modelled(ctx, ls);
  if (m.length < MIN_LEADER_GAMES) return null;
  const expected = m.reduce((s, x) => s + x.xfp, 0);
  const actual = m.reduce((s, x) => s + x.line.points, 0);
  return { value: round1(expected), detail: `actual ${fmt1(actual)}` };
}, fmt1);

export const BOARDS: BoardDef[] = [
  // League leaders, grid order (3 per row)
  { id: 'leadPoints', section: 'leaders', title: 'Most points', definition: 'Fantasy points this season on any roster, started or benched.', valueHeader: 'Pts', compute: leadPoints },
  { id: 'leadYards', section: 'leaders', title: 'Most yards', definition: 'Passing, rushing and receiving yards this season on any roster.', valueHeader: 'Yds', compute: leadYards },
  { id: 'leadTouchdowns', section: 'leaders', title: 'Most touchdowns', definition: 'Passing, rushing and receiving touchdowns this season on any roster.', valueHeader: 'TD', compute: leadTouchdowns },
  { id: 'leadRushYards', section: 'leaders', title: 'Rushing yards', definition: 'Rushing yards this season on any roster.', valueHeader: 'Yds', compute: leadRushYards },
  { id: 'leadRecYards', section: 'leaders', title: 'Receiving yards', definition: 'Receiving yards this season on any roster.', valueHeader: 'Yds', compute: leadRecYards },
  { id: 'leadPassYards', section: 'leaders', title: 'Passing yards', definition: 'Passing yards this season on any roster.', valueHeader: 'Yds', compute: leadPassYards },
  { id: 'leadRushTd', section: 'leaders', title: 'Rushing TDs', definition: 'Rushing touchdowns this season on any roster.', valueHeader: 'TD', compute: leadRushTd },
  { id: 'leadRecTd', section: 'leaders', title: 'Receiving TDs', definition: 'Receiving touchdowns this season on any roster.', valueHeader: 'TD', compute: leadRecTd },
  { id: 'leadPassTd', section: 'leaders', title: 'Passing TDs', definition: 'Passing touchdowns this season on any roster.', valueHeader: 'TD', compute: leadPassTd },
  { id: 'leadPpg', section: 'leaders', title: 'PPG', definition: `Points per game over weeks the player actually played this season. At least ${MIN_LEADER_GAMES} games.`, valueHeader: 'PPG', compute: leadPpg },
  { id: 'leadFpoe', section: 'leaders', title: 'FPOE', definition: `Fantasy points over expected: actual minus xFP, summed over the season. Over shows the luckiest or most efficient, Under the least. At least ${MIN_LEADER_GAMES} modelled games.`, valueHeader: 'FPOE', sortable: true, compute: leadFpoe },
  { id: 'leadXfp', section: 'leaders', title: 'xFP', definition: 'Expected fantasy points from volume: a per-position fit of points on targets, carries and pass attempts across league history. No field position or air yards, so an approximation. QB, RB, WR and TE only.', valueHeader: 'xFP', compute: leadXfp },
  // All-time
  { id: 'bestWeek', section: 'allTime', title: 'Best week by a starter', definition: 'Most points by a player in one week while in a starting lineup.', valueHeader: 'Pts', compute: bestWeek },
  { id: 'bestSeason', section: 'allTime', title: 'Best season by a starter', definition: 'Most points a player scored for one manager in one season while started.', valueHeader: 'Pts', compute: bestSeason },
  { id: 'careerPoints', section: 'allTime', title: 'Most career points started', definition: 'Total points scored while in a starting lineup, every season and manager.', valueHeader: 'Pts', compute: careerPoints },
  { id: 'weeksStarted', section: 'allTime', title: 'Most weeks started', definition: 'Weeks in a starting lineup across every season.', valueHeader: 'Starts', compute: weeksStarted },
  { id: 'benchBlunder', section: 'allTime', title: 'Biggest bench blunder', definition: 'Most points by a player left on the bench in one week.', valueHeader: 'Pts', compute: benchBlunder },
  { id: 'careerPpg', section: 'allTime', title: 'Career PPG', definition: `Points per game over weeks the player actually played, started or benched. At least ${MIN_PPG_GAMES} games.`, valueHeader: 'PPG', compute: careerPpg },
  // Postseason
  { id: 'postPoints', section: 'postseason', title: 'Most postseason points started', definition: 'Points while started in championship-bracket games.', valueHeader: 'Pts', compute: postPoints },
  { id: 'postStarts', section: 'postseason', title: 'Most postseason starts', definition: 'Starts in championship-bracket games.', valueHeader: 'Starts', compute: postStarts },
  { id: 'postTouchdowns', section: 'postseason', title: 'Most postseason touchdowns', definition: 'Passing, rushing and receiving touchdowns while started in the championship bracket.', valueHeader: 'TD', compute: postTouchdowns },
  { id: 'postYards', section: 'postseason', title: 'Most postseason yards', definition: 'Passing, rushing and receiving yards while started in the championship bracket.', valueHeader: 'Yds', compute: postYards },
  { id: 'postReceptions', section: 'postseason', title: 'Most postseason receptions', definition: 'Receptions while started in the championship bracket.', valueHeader: 'Rec', compute: postReceptions },
  { id: 'championshipRosters', section: 'postseason', title: 'Most championship rosters', definition: "Seasons on the champion's roster, starters and bench, in the championship game.", valueHeader: 'Titles', compute: championshipRosters },
  { id: 'postToiletBowl', section: 'postseason', title: 'Most toilet bowl starts', definition: 'Starts in consolation games: the first round, the toilet bowl and the 7th place game.', valueHeader: 'Starts', compute: postToiletBowl },
  // Extras
  { id: 'boomStarts', section: 'extras', title: 'Most 30-point starts', definition: 'Weeks a player scored 30 or more while started.', valueHeader: 'Weeks', compute: boomStarts },
  { id: 'dudStarts', section: 'extras', title: 'Most dud starts', definition: 'Weeks a player played and scored under 5 while started. Unplayed weeks do not count. Kickers and defenses excluded.', valueHeader: 'Weeks', compute: dudStarts },
  { id: 'journeyman', section: 'extras', title: 'Journeyman', definition: 'Different managers who have started the player. Kickers and defenses excluded.', valueHeader: 'Mgrs', compute: journeyman },
  { id: 'draftValue', section: 'extras', title: 'Cumulative draft value', definition: "Sum of the player's draft value across every season they were drafted, from the draft board. The current season's value moves weekly.", valueHeader: 'Value', compute: draftValue },
];
