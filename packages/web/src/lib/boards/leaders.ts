import type { UserId } from '@fantasy-dash/core';
import { fmtPpg, fmtPts, fmtSigned } from '../format';
import type { PlayerLine } from '../playerLines';
import type { Direction, BoardContext, BoardRow } from './shared';
import { fmt1, groupBy, intLabel, metaOf, minGames, parts, perGame, plural, rank, round1, round2, sum, toneOf } from './shared';

export interface LeaderItem { value: number; detail: string | null }

/** Every line given, one row per player; manager = whoever rostered the player most recently. `build` returns null to drop a player. */
export function leaderBoard(ctx: BoardContext, build: (ls: PlayerLine[]) => LeaderItem | null, label: (v: number) => string, direction: Direction = 'desc'): BoardRow[] {
  const items: { playerId: string; value: number; detail: string | null; userId: UserId; latestYear: number; latestWeek: number; lines: PlayerLine[] }[] = [];
  for (const [playerId, g] of groupBy(ctx.lines, (l) => l.playerId)) {
    const built = build(g.lines);
    if (!built) continue;
    const latest = g.lines.reduce((a, b) => (b.year > a.year || (b.year === a.year && b.week > a.week) ? b : a));
    items.push({ playerId, value: built.value, detail: built.detail, userId: latest.userId, latestYear: g.latestYear, latestWeek: g.latestWeek, lines: g.lines });
  }
  const meta = metaOf(ctx);
  return rank(items, direction).map((i) => ({
    key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: label(i.value),
    meta: meta(i.lines), detail: i.detail, userId: i.userId, to: null,
  }));
}
export const positive = (f: (ls: PlayerLine[]) => number, detail: (ls: PlayerLine[]) => string | null = () => null) =>
  (ls: PlayerLine[]): LeaderItem | null => { const v = f(ls); return v > 0 ? { value: v, detail: detail(ls) } : null; };

export const leadPoints = (ctx: BoardContext, _direction?: Direction, mode?: string): BoardRow[] => {
  if (mode === 'ppg') {
    return leaderBoard(ctx, (ls) => {
      const played = ls.filter((l) => l.played);
      if (played.length < minGames(ctx)) return null;
      return { value: round2(sum(played, (l) => l.points) / played.length), detail: plural(played.length, 'game') };
    }, fmtPpg);
  }
  return leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.points)), fmtPts);
};
export const leadYards = (ctx: BoardContext, _d?: Direction, mode?: string): BoardRow[] => {
  const split = (ls: PlayerLine[]) => parts([[sum(ls, (l) => l.passYards), 'pass'], [sum(ls, (l) => l.rushYards), 'rush'], [sum(ls, (l) => l.recYards), 'rec']]);
  if (mode === 'pg') return leaderBoard(ctx, (ls) => { const g = perGame(ctx, ls, (l) => l.yards); return g && g.value > 0 ? { value: g.value, detail: split(ls) } : null; }, fmt1);
  return leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.yards), split), intLabel);
};
export const leadTouchdowns = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.touchdowns)), intLabel);
export const leadRushYards = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.rushYards), (ls) => parts([[sum(ls, (l) => l.carries), 'car']])), intLabel);
export const leadRecYards = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.recYards), (ls) => parts([[sum(ls, (l) => l.receptions), 'rec'], [sum(ls, (l) => l.targets), 'tgt']])), intLabel);
export const leadPassYards = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.passYards), (ls) => parts([[sum(ls, (l) => l.passAttempts), 'att']])), intLabel);
export const leadRushTd = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.rushTd)), intLabel);
export const leadRecTd = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.recTd)), intLabel);
export const leadPassTd = (ctx: BoardContext): BoardRow[] => leaderBoard(ctx, positive((ls) => sum(ls, (l) => l.passTd)), intLabel);

export const leadTouches = (ctx: BoardContext, _d?: Direction, mode?: string, mode2?: string): BoardRow[] => {
  const pick = (l: PlayerLine) => (mode === 'rec' ? l.receptions : mode === 'car' ? l.carries : l.receptions + l.carries);
  const detail = (ls: PlayerLine[]) => parts([[sum(ls, (l) => l.receptions), 'rec'], [sum(ls, (l) => l.carries), 'car'], [sum(ls, (l) => l.targets), 'tgt']]);
  if (mode2 === 'pg') return leaderBoard(ctx, (ls) => { const g = perGame(ctx, ls, pick); return g && g.value > 0 ? { value: g.value, detail: detail(ls) } : null; }, fmt1);
  return leaderBoard(ctx, positive((ls) => sum(ls, pick), detail), intLabel);
};

/** Played lines with a prediction, paired with it. */
export function modelled(ctx: BoardContext, ls: PlayerLine[]): { line: PlayerLine; xfp: number }[] {
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
  if (m.length < minGames(ctx)) return null;
  const expected = m.reduce((s, x) => s + x.xfp, 0);
  const actual = m.reduce((s, x) => s + x.line.points, 0);
  return { value: round1(actual - expected), detail: `xFP ${fmt1(expected)}` };
}, (v) => fmtSigned(v, 1), direction).map((r) => ({ ...r, tone: toneOf(r.value) }));

export const leadXfp = (ctx: BoardContext, _d?: Direction, mode?: string): BoardRow[] => leaderBoard(ctx, (ls) => {
  const m = modelled(ctx, ls);
  if (m.length < minGames(ctx)) return null;
  const expected = m.reduce((s, x) => s + x.xfp, 0);
  const actual = m.reduce((s, x) => s + x.line.points, 0);
  if (mode === 'pg') return { value: round1(expected / m.length), detail: `actual ${fmt1(actual / m.length)} per game` };
  return { value: round1(expected), detail: `actual ${fmt1(actual)}` };
}, fmt1);
