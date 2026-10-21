import type { Game, GameSide, PlayoffTag, Season, UserId, Week } from '@fantasy-dash/core';
import { K, phi } from '../live/outlook';
import { tickerWeek } from '../live/overlay';

export type RegularTag = 'upset' | 'champ' | 'top' | 'shootout';
export type SideTag = RegularTag | PlayoffTag;
export interface Picks { hero: Game | null; sides: { game: Game; tag: SideTag }[] }

const PLAYOFF_ORDER: PlayoffTag[] = ['Final', 'SF', 'QF', '3rd', '5th', 'Cons-R1', 'Cons-7th', 'Toilet Bowl'];
const COMPLETE_ORDER: PlayoffTag[] = ['Final', '3rd', 'Toilet Bowl'];
const EPS = 1e-9;

/** The week the top row shows: the ticker's week in season, the last week with games once it's over. */
export function homeWeek(season: Season, liveNo: number | null): Week | null {
  const w = tickerWeek(season, liveNo);
  if (w) return w;
  if (season.status !== 'complete') return null;
  return [...season.weeks].reverse().find((x) => x.games.length) ?? null;
}

/** Average of a team's last three regular-season scores before `week`; null with none. */
export function recentAvg(season: Season, userId: UserId, week: number): number | null {
  const pts: number[] = [];
  for (const w of season.weeks) {
    if (w.week >= week || !w.played || w.isPlayoff) continue;
    for (const g of w.games) for (const s of g.sides) if (s.userId === userId) pts.push(s.points);
  }
  const last = pts.slice(-3);
  return last.length ? last.reduce((x, y) => x + y, 0) / last.length : null;
}

const winProb = (a: number, b: number) => (a + b > 0 ? phi((a - b) / Math.sqrt(K * (a + b))) : 0.5);

/** recordClose × scoringClose × stakes²: close records, alike scoring, both teams high in the standings. */
export function gameScore(game: Game, rankOf: (u: UserId) => number | null, teams: number): number {
  const [a, b] = game.sides;
  const played = a.recordBefore.w + a.recordBefore.l + a.recordBefore.t;
  const recordClose = played > 0 ? 1 - Math.abs(a.recordBefore.w - b.recordBefore.w) / played : 1;
  const scoringClose = 1 - 2 * Math.abs(winProb(a.seasonPpg, b.seasonPpg) - 0.5);
  const stake = (s: GameSide) => { const r = rankOf(s.userId); return r === null || teams === 0 ? 1 : (teams + 1 - r) / teams; };
  const stakes = (stake(a) + stake(b)) / 2;
  return recordClose * scoringClose * stakes * stakes;
}

/** Standings mean something once a regular-season week is played; before that every team is 0-0 in placeholder order. */
export const hasRanks = (season: Season): boolean => season.weeks.some((w) => w.played && !w.isPlayoff);

const combined = (g: Game) => g.sides[0].seasonPpg + g.sides[1].seasonPpg;
const has = (g: Game, u: UserId) => g.sides.some((s) => s.userId === u);

function pickPlayoff(games: Game[], order: PlayoffTag[], rankOf: (u: UserId) => number | null): Picks {
  const seed = (g: Game) => Math.min(...g.sides.map((s) => rankOf(s.userId) ?? Infinity));
  const ranked = games
    .filter((g) => g.tag && order.includes(g.tag))
    .sort((x, y) => order.indexOf(x.tag!) - order.indexOf(y.tag!) || seed(x) - seed(y) || x.matchupId - y.matchupId);
  return { hero: ranked[0] ?? null, sides: ranked.slice(1, 3).map((g) => ({ game: g, tag: g.tag! })) };
}

/** The game whose team with fewer wins has the higher recent average; biggest gap in wins first. */
function upsetGame(season: Season, week: number, games: Game[]): Game | undefined {
  let best: Game | undefined; let gap = 0;
  for (const g of games) {
    const [a, b] = g.sides;
    if (a.recordBefore.w === b.recordBefore.w) continue;
    const [under, over] = a.recordBefore.w < b.recordBefore.w ? [a, b] : [b, a];
    const ru = recentAvg(season, under.userId, week); const ro = recentAvg(season, over.userId, week);
    if (ru === null || ro === null || ru <= ro) continue;
    const d = over.recordBefore.w - under.recordBefore.w;
    if (d > gap) { best = g; gap = d; }
  }
  return best;
}

/** Game of the week and up to two tagged games, from synced results only (never projections). */
export function pickGames(season: Season, week: Week, champion: UserId | null): Picks {
  const ranks = new Map(hasRanks(season) ? season.standings.map((r) => [r.userId, r.rank]) : []);
  const rankOf = (u: UserId) => ranks.get(u) ?? null;
  const games = [...week.games].sort((x, y) => x.matchupId - y.matchupId);
  if (!games.length) return { hero: null, sides: [] };
  if (week.isPlayoff) return pickPlayoff(games, season.status === 'complete' ? COMPLETE_ORDER : PLAYOFF_ORDER, rankOf);

  const teams = ranks.size;
  let hero = games[0]; let best = gameScore(hero, rankOf, teams);
  for (const g of games.slice(1)) {
    const s = gameScore(g, rankOf, teams);
    if (s > best + EPS || (Math.abs(s - best) <= EPS && combined(g) > combined(hero))) { hero = g; best = s; }
  }
  const left = games.filter((g) => g !== hero);
  const sides: Picks['sides'] = [];
  const take = (tag: RegularTag, g: Game | undefined) => {
    if (!g || sides.length >= 2) return;
    sides.push({ game: g, tag });
    left.splice(left.indexOf(g), 1);
  };
  take('upset', upsetGame(season, week.week, left));
  take('champ', champion ? left.find((g) => has(g, champion)) : undefined);
  const first = [...ranks].find(([, r]) => r === 1)?.[0];
  take('top', first ? left.find((g) => has(g, first)) : undefined);
  take('shootout', left.reduce<Game | undefined>((m, g) => (!m || combined(g) > combined(m) ? g : m), undefined));
  return { hero, sides };
}
