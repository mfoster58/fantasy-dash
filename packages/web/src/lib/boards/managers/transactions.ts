import type { Transaction, UserId } from '@fantasy-dash/core';
import { fmtPts } from '../../format';
import { isHit, judged, waiverClaims, type WaiverClaim } from '../../waivers';
import type { BoardContext, BoardRow } from '../shared';
import { boxScore, inYear, plural, posOk, rank, round2, when } from '../shared';
import { seasonRows } from './shared';

interface YearTx { year: number; tx: Transaction }
const scoped = (ctx: BoardContext): YearTx[] => ctx.transactions.filter((s) => inYear(ctx, s.year)).flatMap((s) => s.transactions.map((tx) => ({ year: s.year, tx })));
const parties = (tx: Transaction): UserId[] => [...new Set([...tx.adds, ...tx.drops].map((m) => m.userId))];
const dollars = (v: number) => `$${v}`;
const scopeMeta = (ctx: BoardContext, years: Set<number>) => (ctx.year === null ? plural(years.size, 'season') : String(ctx.year));

interface Event { userId: UserId; year: number; created: number; n: number }
interface Tally { n: number; years: Set<number>; latest: number }
function tally(events: Event[]): Map<UserId, Tally> {
  const out = new Map<UserId, Tally>();
  for (const e of events) {
    const t = out.get(e.userId) ?? { n: 0, years: new Set<number>(), latest: 0 };
    t.n += e.n; t.years.add(e.year); t.latest = Math.max(t.latest, e.created);
    out.set(e.userId, t);
  }
  return out;
}
const events = (ctx: BoardContext, f: (tx: Transaction) => { userId: UserId; n: number }[]): Map<UserId, Tally> =>
  tally(scoped(ctx).flatMap(({ year, tx }) => f(tx).map((e) => ({ ...e, year, created: tx.created }))));
/** One row per manager from a tally; the most recent event breaks ties. */
function tallyRows(ctx: BoardContext, map: Map<UserId, Tally>, label: (v: number) => string, detail: (t: Tally) => string | null = () => null): BoardRow[] {
  const items = [...map.entries()].filter(([, t]) => t.n > 0).map(([userId, t]) => ({ userId, t, value: t.n, latestYear: Math.max(...t.years), latestWeek: 0, secondary: t.latest }));
  return rank(items).map((i) => ({ key: i.userId, playerId: null, value: i.value, valueLabel: label(i.value), meta: scopeMeta(ctx, i.t.years), detail: detail(i.t), userId: i.userId, to: null }));
}
const addsOf = (tx: Transaction) => (tx.type === 'trade' ? [] : tx.adds.map((m) => ({ userId: m.userId, n: 1 })));
const dropsOf = (tx: Transaction) => (tx.type === 'trade' ? [] : tx.drops.map((m) => ({ userId: m.userId, n: 1 })));
const tradesOf = (tx: Transaction) => (tx.type === 'trade' ? parties(tx).map((userId) => ({ userId, n: 1 })) : []);
const bidsOf = (tx: Transaction) => (tx.type === 'waiver' && tx.bid !== null && tx.bid > 0 ? tx.adds.map((m) => ({ userId: m.userId, n: tx.bid! })) : []);
/** per manager-season sums, keyed `${year}|${userId}` */
function perSeason(ctx: BoardContext, f: (tx: Transaction) => { userId: UserId; n: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const { year, tx } of scoped(ctx)) for (const e of f(tx)) out.set(`${year}|${e.userId}`, (out.get(`${year}|${e.userId}`) ?? 0) + e.n);
  return out;
}

export const mtAdds = (ctx: BoardContext): BoardRow[] => tallyRows(ctx, events(ctx, addsOf), String);
export const mtDrops = (ctx: BoardContext): BoardRow[] => tallyRows(ctx, events(ctx, dropsOf), String);
export const mtTrades = (ctx: BoardContext): BoardRow[] => tallyRows(ctx, events(ctx, tradesOf), String);
export const mtBusiest = (ctx: BoardContext): BoardRow[] => {
  const adds = perSeason(ctx, addsOf); const drops = perSeason(ctx, dropsOf); const trades = perSeason(ctx, tradesOf);
  const k = (ms: { year: number; userId: UserId }) => `${ms.year}|${ms.userId}`;
  const total = (ms: { year: number; userId: UserId }) => (adds.get(k(ms)) ?? 0) + (drops.get(k(ms)) ?? 0) + (trades.get(k(ms)) ?? 0);
  return seasonRows(ctx, (ms) => total(ms) || null, String, (ms) => `${plural(adds.get(k(ms)) ?? 0, 'add')} · ${plural(drops.get(k(ms)) ?? 0, 'drop')} · ${plural(trades.get(k(ms)) ?? 0, 'trade')}`);
};
export const mtFaabCareer = (ctx: BoardContext): BoardRow[] => tallyRows(ctx, events(ctx, bidsOf), dollars);
/** the largest winning bid at the board's position, the player shown beside the manager */
export const mtBiggestBid = (ctx: BoardContext): BoardRow[] => {
  const items = scoped(ctx).flatMap(({ year, tx }) => (tx.type === 'waiver' && tx.bid !== null && tx.bid > 0 ? tx.adds.filter((m) => posOk(ctx, m.playerId)).map((m) => ({ year, tx, m, userId: m.userId, value: tx.bid!, latestYear: year, latestWeek: tx.week })) : []));
  return rank(items).map((i) => ({ key: `${i.tx.id}-${i.m.playerId}`, playerId: null, player: i.m.playerId, value: i.value, valueLabel: dollars(i.value), meta: `${i.year} · Wk ${i.tx.week}`, detail: null, userId: i.userId, to: null }));
};

const claims = (ctx: BoardContext): WaiverClaim[] => waiverClaims(ctx.transactions.filter((s) => inYear(ctx, s.year)), ctx.lines);
const bidLabel = (c: WaiverClaim) => (c.bid === null ? 'FA' : dollars(c.bid));
const MIN_JUDGED = 25;
/** per manager: dollars on judged bids, split into hits and flops; open claims are not judged yet */
function faabVerdicts(ctx: BoardContext): Map<UserId, { judged: number; hit: number; flopped: number; claims: number; hits: number; flops: number; years: Set<number>; latest: number }> {
  const by = new Map<UserId, { judged: number; hit: number; flopped: number; claims: number; hits: number; flops: number; years: Set<number>; latest: number }>();
  for (const c of claims(ctx)) {
    if (!judged(c)) continue;
    const t = by.get(c.userId) ?? { judged: 0, hit: 0, flopped: 0, claims: 0, hits: 0, flops: 0, years: new Set<number>(), latest: 0 };
    t.judged += c.bid; t.claims += 1; t.years.add(c.year); t.latest = Math.max(t.latest, c.year * 100 + c.week);
    if (isHit(c)) { t.hit += c.bid; t.hits += 1; } else { t.flopped += c.bid; t.flops += 1; }
    by.set(c.userId, t);
  }
  return by;
}
/** dollars bid on flops: judged claims that returned under FLOP_POINTS started points */
export const mtFaabWasted = (ctx: BoardContext): BoardRow[] => {
  const items = [...faabVerdicts(ctx).entries()].filter(([, t]) => t.flopped > 0).map(([userId, t]) => ({ userId, t, value: t.flopped, latestYear: Math.max(...t.years), latestWeek: 0, secondary: t.latest }));
  return rank(items).map((i) => ({ key: i.userId, playerId: null, value: i.value, valueLabel: dollars(i.value), meta: scopeMeta(ctx, i.t.years), detail: `of ${dollars(i.t.judged)} spent · ${plural(i.t.flops, 'flop')}`, userId: i.userId, to: null }));
};
/** share of judged dollars that went on hits, managers with at least MIN_JUDGED judged */
export const mtFaabValue = (ctx: BoardContext): BoardRow[] => {
  const items = [...faabVerdicts(ctx).entries()].filter(([, t]) => t.judged >= MIN_JUDGED).map(([userId, t]) => ({ userId, t, value: Math.round((t.hit / t.judged) * 100), latestYear: Math.max(...t.years), latestWeek: 0, secondary: t.latest }));
  return rank(items).map((i) => ({ key: i.userId, playerId: null, value: i.value, valueLabel: `${i.value}%`, meta: scopeMeta(ctx, i.t.years), detail: `${dollars(i.t.hit)} of ${dollars(i.t.judged)} · ${i.t.hits} of ${i.t.claims} claims hit`, userId: i.userId, to: null }));
};
/** the pickup that returned the most started points at the board's position, the player shown beside the manager */
export const mtBestPickup = (ctx: BoardContext): BoardRow[] =>
  rank(claims(ctx).filter((c) => posOk(ctx, c.playerId)).map((c) => ({ c, userId: c.userId, value: c.points, latestYear: c.year, latestWeek: c.week })))
    .map(({ c, value }) => ({ key: `${c.year}-${c.week}-${c.playerId}-${c.userId}`, playerId: null, player: c.playerId, value, valueLabel: fmtPts(value), meta: `${c.year} · Wk ${c.week}`, detail: `${bidLabel(c)} · ${plural(c.starts, 'start')}`, userId: c.userId, to: null }));
/** the best single start by a pickup while on the claimer's roster, at the board's position, linking to the box score */
export const mtBestStart = (ctx: BoardContext): BoardRow[] =>
  rank(claims(ctx).filter((c) => posOk(ctx, c.playerId)).flatMap((c) => c.lines.map((l) => ({ c, l, userId: c.userId, value: l.points, latestYear: l.year, latestWeek: l.week }))))
    .map(({ c, l, value }) => ({ key: `${l.gameId}-${l.playerId}-${c.userId}`, playerId: null, player: c.playerId, value, valueLabel: fmtPts(value), meta: when(l), detail: bidLabel(c), userId: c.userId, to: boxScore(l) }));
/** per-manager totals over every pickup in scope */
function pickupTotals(ctx: BoardContext): Map<UserId, { starts: number; points: number; years: Set<number>; latest: number }> {
  const by = new Map<UserId, { starts: number; points: number; years: Set<number>; latest: number }>();
  for (const c of claims(ctx)) {
    const t = by.get(c.userId) ?? { starts: 0, points: 0, years: new Set<number>(), latest: 0 };
    t.starts += c.starts; t.points = round2(t.points + c.points); t.years.add(c.year); t.latest = Math.max(t.latest, c.year * 100 + c.week);
    by.set(c.userId, t);
  }
  return by;
}
export const mtWaiverStarts = (ctx: BoardContext): BoardRow[] => {
  const items = [...pickupTotals(ctx).entries()].filter(([, t]) => t.starts > 0).map(([userId, t]) => ({ userId, t, value: t.starts, latestYear: Math.max(...t.years), latestWeek: 0, secondary: t.latest }));
  return rank(items).map((i) => ({ key: i.userId, playerId: null, value: i.value, valueLabel: String(i.value), meta: scopeMeta(ctx, i.t.years), detail: `${fmtPts(i.t.points)} pts`, userId: i.userId, to: null }));
};
export const mtWaiverPoints = (ctx: BoardContext): BoardRow[] => {
  const items = [...pickupTotals(ctx).entries()].filter(([, t]) => t.points > 0).map(([userId, t]) => ({ userId, t, value: t.points, latestYear: Math.max(...t.years), latestWeek: 0, secondary: t.latest }));
  return rank(items).map((i) => ({ key: i.userId, playerId: null, value: i.value, valueLabel: fmtPts(i.value), meta: scopeMeta(ctx, i.t.years), detail: plural(i.t.starts, 'start'), userId: i.userId, to: null }));
};
