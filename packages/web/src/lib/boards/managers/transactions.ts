import type { Transaction, UserId } from '@fantasy-dash/core';
import { fmtPts } from '../../format';
import { playerName } from '../../players';
import { waiverClaims, type WaiverClaim } from '../../waivers';
import type { BoardContext, BoardRow } from '../shared';
import { inYear, plural, rank, round1, round2 } from '../shared';
import { seasonRows } from './shared';

const DAY = 86_400_000;
interface YearTx { year: number; tx: Transaction }
const scoped = (ctx: BoardContext): YearTx[] => ctx.transactions.filter((s) => inYear(ctx, s.year)).flatMap((s) => s.transactions.map((tx) => ({ year: s.year, tx })));
const parties = (tx: Transaction): UserId[] => [...new Set([...tx.adds, ...tx.drops].map((m) => m.userId))];
const isPickup = (tx: Transaction) => (tx.type === 'waiver' && tx.bid !== null) || tx.type === 'free_agent';
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
export const mtFaabSeason = (ctx: BoardContext): BoardRow[] => { const bids = perSeason(ctx, bidsOf); return seasonRows(ctx, (ms) => bids.get(`${ms.year}|${ms.userId}`) ?? null, dollars, () => null); };
export const mtFaabCareer = (ctx: BoardContext): BoardRow[] => tallyRows(ctx, events(ctx, bidsOf), dollars);
export const mtBiggestBid = (ctx: BoardContext): BoardRow[] => {
  const items = scoped(ctx).flatMap(({ year, tx }) => (tx.type === 'waiver' && tx.bid !== null && tx.bid > 0 ? tx.adds.map((m) => ({ year, tx, m, userId: m.userId, value: tx.bid!, latestYear: year, latestWeek: tx.week })) : []));
  return rank(items).map((i) => ({ key: `${i.tx.id}-${i.m.playerId}`, playerId: null, value: i.value, valueLabel: dollars(i.value), meta: `${i.year} · Wk ${i.tx.week}`, detail: playerName(ctx.players, i.m.playerId), userId: i.userId, to: null }));
};

const claims = (ctx: BoardContext): WaiverClaim[] => waiverClaims(ctx.transactions.filter((s) => inYear(ctx, s.year)), ctx.lines);
const MIN_SPEND = 25;
function perPoint(ctx: BoardContext, direction: 'asc' | 'desc'): BoardRow[] {
  const by = new Map<UserId, { spent: number; points: number; years: Set<number>; latest: number }>();
  for (const c of claims(ctx)) {
    if (c.bid === null) continue;
    const t = by.get(c.userId) ?? { spent: 0, points: 0, years: new Set<number>(), latest: 0 };
    t.spent += c.bid; t.points += c.points; t.years.add(c.year); t.latest = Math.max(t.latest, c.year * 100 + c.week);
    by.set(c.userId, t);
  }
  const items = [...by.entries()].filter(([, t]) => t.spent >= MIN_SPEND).map(([userId, t]) => ({ userId, t, value: round2(t.spent / Math.max(t.points, 1)), latestYear: Math.max(...t.years), latestWeek: 0, secondary: t.latest }));
  return rank(items, direction).map((i) => ({ key: i.userId, playerId: null, value: i.value, valueLabel: `$${i.value.toFixed(2)}/pt`, meta: scopeMeta(ctx, i.t.years), detail: `$${i.t.spent} · ${fmtPts(round1(i.t.points))} pts`, userId: i.userId, to: null }));
}
export const mtCheap = (ctx: BoardContext): BoardRow[] => perPoint(ctx, 'asc');
export const mtCostly = (ctx: BoardContext): BoardRow[] => perPoint(ctx, 'desc');
export const mtBestPickup = (ctx: BoardContext): BoardRow[] =>
  rank(claims(ctx).map((c) => ({ c, userId: c.userId, value: c.points, latestYear: c.year, latestWeek: c.week })))
    .map(({ c, value }) => ({ key: `${c.year}-${c.week}-${c.playerId}-${c.userId}`, playerId: null, value, valueLabel: fmtPts(value), meta: `${c.year} · Wk ${c.week}`, detail: `${playerName(ctx.players, c.playerId)} · ${c.bid === null ? 'FA' : dollars(c.bid)} · ${plural(c.starts, 'start')}`, userId: c.userId, to: null }));
/** Days between a pickup and the same manager dropping that player, fewest first. */
export const mtQuickCut = (ctx: BoardContext): BoardRow[] => {
  const items: { userId: UserId; playerId: string; value: number; year: number; week: number; latestYear: number; latestWeek: number; key: string }[] = [];
  for (const s of ctx.transactions.filter((x) => inYear(ctx, x.year))) {
    const sorted = [...s.transactions].sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : 1));
    for (const tx of sorted) {
      if (!isPickup(tx)) continue;
      for (const add of tx.adds) {
        const drop = sorted.find((o) => o.type !== 'trade' && o.created > tx.created && o.drops.some((d) => d.playerId === add.playerId && d.userId === add.userId));
        if (!drop) continue;
        items.push({ userId: add.userId, playerId: add.playerId, value: round1((drop.created - tx.created) / DAY), year: s.year, week: tx.week, latestYear: s.year, latestWeek: tx.week, key: `${tx.id}-${add.playerId}` });
      }
    }
  }
  return rank(items, 'asc').map((i) => ({ key: i.key, playerId: null, value: i.value, valueLabel: `${i.value.toFixed(1)} days`, meta: `${i.year} · Wk ${i.week}`, detail: playerName(ctx.players, i.playerId), userId: i.userId, to: null }));
};
