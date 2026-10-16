import type { DraftPick, UserId } from '@fantasy-dash/core';
import { fmtSigned } from '../../format';
import { playerName } from '../../players';
import type { BoardContext, BoardRow, Direction } from '../shared';
import { inYear, plural, rank, round1, toneOf } from '../shared';
import { careerMeta } from './shared';

type Valued = DraftPick & { value: number };
interface YearPick { year: number; p: Valued }
const complete = (ctx: BoardContext, year: number) => ctx.managerSeasons.some((ms) => ms.year === year && ms.complete);
/** every valued pick in scope: complete seasons under All-time, the chosen year otherwise */
const valuedPicks = (ctx: BoardContext): YearPick[] => Object.entries(ctx.drafts).flatMap(([y, d]) => {
  const year = Number(y);
  if (!d || !inYear(ctx, year) || (ctx.year === null && !complete(ctx, year))) return [];
  return d.picks.filter((p): p is Valued => p.value !== null).map((p) => ({ year, p }));
});
const slot = (p: DraftPick) => `Rd ${p.round}, pick ${p.pickNo}`;
const signed = (v: number) => fmtSigned(v, 1);
const withTone = (rows: BoardRow[]): BoardRow[] => rows.map((r) => ({ ...r, tone: toneOf(r.value) }));

function classRows(ctx: BoardContext, keep: (yp: YearPick) => boolean, direction: Direction): BoardRow[] {
  const groups = new Map<string, { year: number; userId: UserId; picks: Valued[] }>();
  for (const yp of valuedPicks(ctx).filter(keep)) {
    const k = `${yp.year}|${yp.p.userId}`;
    const g = groups.get(k) ?? { year: yp.year, userId: yp.p.userId, picks: [] };
    g.picks.push(yp.p);
    groups.set(k, g);
  }
  const items = [...groups.values()].map((g) => ({ g, userId: g.userId, value: round1(g.picks.reduce((t, p) => t + p.value, 0)), latestYear: g.year, latestWeek: 0 }));
  return withTone(rank(items, direction).map((i) => ({ key: `${i.g.year}-${i.g.userId}`, playerId: null, value: i.value, valueLabel: signed(i.value), meta: String(i.g.year), detail: plural(i.g.picks.length, 'pick'), userId: i.g.userId, to: `/draft/${i.g.year}` })));
}
function pickRows(ctx: BoardContext, direction: Direction): BoardRow[] {
  const items = valuedPicks(ctx).map((yp) => ({ yp, userId: yp.p.userId, value: round1(yp.p.value), latestYear: yp.year, latestWeek: 0 }));
  return withTone(rank(items, direction).map((i) => ({ key: `${i.yp.year}-${i.yp.p.pickNo}`, playerId: null, value: i.value, valueLabel: signed(i.value), meta: String(i.yp.year), detail: `${playerName(ctx.players, i.yp.p.playerId)} · ${slot(i.yp.p)}`, userId: i.userId, to: `/draft/${i.yp.year}` })));
}

export const mdBestClass = (ctx: BoardContext): BoardRow[] => classRows(ctx, () => true, 'desc');
export const mdWorstClass = (ctx: BoardContext): BoardRow[] => classRows(ctx, () => true, 'asc');
export const mdSteal = (ctx: BoardContext): BoardRow[] => pickRows(ctx, 'desc');
export const mdBust = (ctx: BoardContext): BoardRow[] => pickRows(ctx, 'asc');
export const mdLate = (ctx: BoardContext): BoardRow[] => classRows(ctx, (yp) => yp.p.round >= 9, 'desc');
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
