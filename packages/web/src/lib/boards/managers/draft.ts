import type { DraftPick, UserId } from '@fantasy-dash/core';
import { fmtPpg, fmtSigned } from '../../format';
import type { BoardContext, BoardRow, Direction } from '../shared';
import { inYear, plural, posOk, rank, round1, toneOf } from '../shared';
import { careerMeta } from './shared';

type Valued = DraftPick & { value: number };
interface YearPick { year: number; p: Valued }
const complete = (ctx: BoardContext, year: number) => ctx.managerSeasons.some((ms) => ms.year === year && ms.complete);
/** every valued pick in scope, keepers included: complete seasons under All-time, the chosen year otherwise */
const valuedPicks = (ctx: BoardContext): YearPick[] => Object.entries(ctx.drafts).flatMap(([y, d]) => {
  const year = Number(y);
  if (!d || !inYear(ctx, year) || (ctx.year === null && !complete(ctx, year))) return [];
  return d.picks.filter((p): p is Valued => p.value !== null).map((p) => ({ year, p }));
});
/** the picks a manager actually made on the clock: no keepers */
const drafted = (ctx: BoardContext): YearPick[] => valuedPicks(ctx).filter((yp) => !yp.p.isKeeper);
const slot = (p: DraftPick) => `Rd ${p.round}, pick ${p.pickNo}`;
const signed = (v: number) => fmtSigned(v, 1);
const withTone = (rows: BoardRow[]): BoardRow[] => rows.map((r) => ({ ...r, tone: toneOf(r.value) }));
/** the draft board, with the manager's column highlighted and his team opened */
const boardLink = (year: number, userId: UserId) => `/draft/${year}?team=${userId}`;
/** "Rd 9, pick 81 · WR24 → WR4 · 14.2 PPG": the ranks and PPG only when known */
function pickDetail(ctx: BoardContext, yp: YearPick): string {
  const pos = ctx.players[yp.p.playerId]?.position ?? null;
  const finish = ctx.playerSeasons[yp.year]?.[yp.p.playerId]?.posRank ?? null;
  const parts = [slot(yp.p)];
  if (pos && yp.p.posDraftRank !== null && finish !== null) parts.push(`${pos}${yp.p.posDraftRank} → ${pos}${finish}`);
  if (yp.p.ppg !== null) parts.push(`${fmtPpg(yp.p.ppg)} PPG`);
  return parts.join(' · ');
}

function classRows(ctx: BoardContext, picks: YearPick[], direction: Direction): BoardRow[] {
  const groups = new Map<string, { year: number; userId: UserId; picks: Valued[] }>();
  for (const yp of picks) {
    const k = `${yp.year}|${yp.p.userId}`;
    const g = groups.get(k) ?? { year: yp.year, userId: yp.p.userId, picks: [] };
    g.picks.push(yp.p);
    groups.set(k, g);
  }
  const items = [...groups.values()].map((g) => ({ g, userId: g.userId, value: round1(g.picks.reduce((t, p) => t + p.value, 0)), latestYear: g.year, latestWeek: 0 }));
  return withTone(rank(items, direction).map((i) => ({ key: `${i.g.year}-${i.g.userId}`, playerId: null, value: i.value, valueLabel: signed(i.value), meta: String(i.g.year), detail: plural(i.g.picks.length, 'pick'), userId: i.g.userId, to: boardLink(i.g.year, i.g.userId) })));
}
/** one row per drafted pick at the board's position, the player shown beside the manager */
function pickRows(ctx: BoardContext, direction: Direction): BoardRow[] {
  const items = drafted(ctx).filter((yp) => posOk(ctx, yp.p.playerId)).map((yp) => ({ yp, userId: yp.p.userId, value: round1(yp.p.value), latestYear: yp.year, latestWeek: 0 }));
  return withTone(rank(items, direction).map((i) => ({ key: `${i.yp.year}-${i.yp.p.pickNo}`, playerId: null, player: i.yp.p.playerId, value: i.value, valueLabel: signed(i.value), meta: String(i.yp.year), detail: pickDetail(ctx, i.yp), userId: i.userId, to: boardLink(i.yp.year, i.userId) })));
}

export const mdBestClass = (ctx: BoardContext): BoardRow[] => classRows(ctx, valuedPicks(ctx), 'desc');
export const mdWorstClass = (ctx: BoardContext): BoardRow[] => classRows(ctx, valuedPicks(ctx), 'asc');
export const mdSteal = (ctx: BoardContext): BoardRow[] => pickRows(ctx, 'desc');
export const mdBust = (ctx: BoardContext): BoardRow[] => pickRows(ctx, 'asc');
export const mdLate = (ctx: BoardContext): BoardRow[] => classRows(ctx, drafted(ctx).filter((yp) => yp.p.round >= 9), 'desc');
export const firstRoundEmpty = (): string => 'Needs first-round picks from two complete seasons.';
/** Average first-round pick value per manager over complete seasons, at least two. */
export const mdFirstRound = (ctx: BoardContext): BoardRow[] => {
  const by = new Map<UserId, YearPick[]>();
  for (const yp of valuedPicks(ctx)) if (yp.p.round === 1 && complete(ctx, yp.year)) by.set(yp.p.userId, [...(by.get(yp.p.userId) ?? []), yp]);
  const items = [...by.entries()]
    .filter(([, ps]) => new Set(ps.map((y) => y.year)).size >= 2)
    .map(([userId, ps]) => ({ userId, ps, value: round1(ps.reduce((t, y) => t + y.p.value, 0) / ps.length), latestYear: Math.max(...ps.map((y) => y.year)), latestWeek: 0 }));
  return withTone(rank(items).map((i) => ({ key: i.userId, playerId: null, value: i.value, valueLabel: signed(i.value), meta: careerMeta(i.ps.map((y) => y.year)), detail: plural(i.ps.length, 'first-round pick'), userId: i.userId, to: null })));
};

/**
 * Rookies a manager took in one draft, keepers aside. The directory holds today's years in the league,
 * so a rookie of that draft has as many years as seasons have passed since (counting from the latest draft).
 */
export const mdRookies = (ctx: BoardContext): BoardRow[] => {
  const years = Object.keys(ctx.drafts).map(Number);
  const now = Math.max(...years);
  const groups = new Map<string, { year: number; userId: UserId; rookies: number; picks: number }>();
  for (const [y, d] of Object.entries(ctx.drafts)) {
    const year = Number(y);
    if (!d || !inYear(ctx, year)) continue;
    for (const p of d.picks) {
      if (p.isKeeper) continue;
      const k = `${year}|${p.userId}`;
      const g = groups.get(k) ?? { year, userId: p.userId, rookies: 0, picks: 0 };
      g.picks++;
      if (ctx.players[p.playerId]?.yearsExp === now - year) g.rookies++;
      groups.set(k, g);
    }
  }
  const items = [...groups.values()].filter((g) => g.rookies > 0).map((g) => ({ g, userId: g.userId, value: g.rookies, latestYear: g.year, latestWeek: 0 }));
  return rank(items).map((i) => ({ key: `${i.g.year}-${i.g.userId}`, playerId: null, value: i.value, valueLabel: String(i.value), meta: String(i.g.year), detail: `${i.g.rookies} of ${plural(i.g.picks, 'pick')}`, userId: i.userId, to: boardLink(i.g.year, i.g.userId) }));
};
