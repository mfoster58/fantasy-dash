import type { Transaction, UserId } from '@fantasy-dash/core';
import { fmtPts, fmtSigned } from '../format';
import type { PlayerLine } from '../playerLines';
import { longestStartRun } from '../ironman';
import { waiverClaims, type WaiverClaim } from '../waivers';
import type { BoardContext, BoardRow, Direction, DraftValue } from './shared';
import { careerBoard, groupBy, inYear, intLabel, matchesPos, metaOf, momentBoard, plural, rank, round1, skillOnly, started, sum, toneOf } from './shared';

const txInScope = (ctx: BoardContext): { year: number; tx: Transaction }[] =>
  ctx.transactions.filter((s) => inYear(ctx, s.year)).flatMap((s) => s.transactions.map((tx) => ({ year: s.year, tx })));
const posOk = (ctx: BoardContext, playerId: string) => matchesPos(ctx.players[playerId]?.position ?? '?', ctx.pos);
const seasonsMeta = (ctx: BoardContext, years: Set<number>) => (ctx.year === null ? plural(years.size, 'season') : String(ctx.year));

export const benchBlunder = (ctx: BoardContext): BoardRow[] => momentBoard(ctx.lines.filter((l) => !l.started), (l) => l.points, fmtPts);

export const benchWarmers = (ctx: BoardContext): BoardRow[] =>
  careerBoard(ctx.lines.filter((l) => !l.started), (ls) => sum(ls, (l) => l.points), fmtPts, (ls) => `${plural(ls.length, 'week')} benched`, metaOf(ctx));

/** Most starts for a single manager; a tie between managers goes to the one with the newer start. */
export const loyalty = (ctx: BoardContext): BoardRow[] => {
  const meta = metaOf(ctx);
  const items: { playerId: string; value: number; userId: UserId; total: number; lines: PlayerLine[]; latestYear: number; latestWeek: number }[] = [];
  for (const [playerId, g] of groupBy(skillOnly(started(ctx)), (l) => l.playerId)) {
    let best: { userId: UserId; starts: number; latest: number } | null = null;
    for (const [userId, m] of groupBy(g.lines, (l) => l.userId)) {
      const latest = m.latestYear * 100 + m.latestWeek;
      if (!best || m.lines.length > best.starts || (m.lines.length === best.starts && latest > best.latest)) best = { userId, starts: m.lines.length, latest };
    }
    if (best) items.push({ playerId, value: best.starts, userId: best.userId, total: g.lines.length, lines: g.lines, latestYear: g.latestYear, latestWeek: g.latestWeek });
  }
  return rank(items).map((i) => ({ key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: String(i.value), meta: meta(i.lines), detail: `of ${plural(i.total, 'start')}`, userId: i.userId, to: null }));
};

export const ironman = (ctx: BoardContext): BoardRow[] => {
  const runs = longestStartRun(skillOnly(ctx.lines));
  const items = [...runs.entries()].map(([playerId, r]) => ({ playerId, value: r.length, run: r, latestYear: r.to.year, latestWeek: r.to.week }));
  return rank(items).map((i) => ({
    key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: String(i.value),
    meta: `${i.run.from.year} Wk ${i.run.from.week} – ${i.run.to.year} Wk ${i.run.to.week}`, detail: i.run.active ? 'active' : null, userId: null, to: null,
  }));
};

export const boomStarts = (ctx: BoardContext): BoardRow[] =>
  careerBoard(started(ctx), (ls) => ls.filter((l) => l.points >= 30).length, intLabel, (ls) => plural(ls.length, 'start'), metaOf(ctx));
export const dudStarts = (ctx: BoardContext): BoardRow[] =>
  careerBoard(skillOnly(started(ctx)), (ls) => ls.filter((l) => l.played && l.points < 5).length, intLabel, (ls) => plural(ls.length, 'start'), metaOf(ctx));
export const journeyman = (ctx: BoardContext): BoardRow[] =>
  careerBoard(skillOnly(started(ctx)), (ls) => new Set(ls.map((l) => l.userId)).size, intLabel, (ls) => plural(ls.length, 'start'), metaOf(ctx));

export const draftValue = (ctx: BoardContext, direction: Direction = 'desc'): BoardRow[] => {
  const byPlayer = new Map<string, DraftValue[]>();
  for (const p of ctx.picks) {
    if (!matchesPos(ctx.players[p.playerId]?.position ?? '?', ctx.pos)) continue;
    byPlayer.set(p.playerId, [...(byPlayer.get(p.playerId) ?? []), p]);
  }
  const items = [...byPlayer.entries()].map(([playerId, picks]) => ({
    playerId, value: round1(picks.reduce((s, p) => s + p.value, 0) / picks.length), seasons: picks.length,
    latestYear: Math.max(...picks.map((p) => p.year)), latestWeek: 0,
  }));
  return rank(items, direction).map((i) => ({
    key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: fmtSigned(i.value, 1),
    meta: plural(i.seasons, 'season'), detail: null, userId: null, to: null, tone: toneOf(i.value),
  }));
};

/** Rows from per-player event counts; ties fall to the most recent event. */
function countBoard(ctx: BoardContext, events: { playerId: string; year: number; created: number; group: string }[], detail: (groups: Set<string>, n: number) => string): BoardRow[] {
  const by = new Map<string, { n: number; years: Set<number>; groups: Set<string>; latest: number }>();
  for (const e of events) {
    if (!posOk(ctx, e.playerId)) continue;
    const g = by.get(e.playerId) ?? { n: 0, years: new Set<number>(), groups: new Set<string>(), latest: 0 };
    g.n += 1; g.years.add(e.year); g.groups.add(e.group); g.latest = Math.max(g.latest, e.created);
    by.set(e.playerId, g);
  }
  const items = [...by.entries()].map(([playerId, g]) => ({ playerId, value: g.n, g, latestYear: Math.max(...g.years), latestWeek: 0, secondary: g.latest }));
  return rank(items).map((i) => ({ key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: String(i.value), meta: seasonsMeta(ctx, i.g.years), detail: detail(i.g.groups, i.g.n), userId: null, to: null }));
}

export const tradeBait = (ctx: BoardContext): BoardRow[] => countBoard(ctx,
  txInScope(ctx).filter(({ tx }) => tx.type === 'trade').flatMap(({ year, tx }) => tx.adds.map((a) => ({ playerId: a.playerId, year, created: tx.created, group: a.userId }))),
  (managers) => plural(managers.size, 'manager'));

export const fodder = (ctx: BoardContext): BoardRow[] => {
  const scoped = txInScope(ctx);
  const pickups = new Map<string, number>();
  for (const { tx } of scoped) if (tx.type !== 'trade') for (const a of tx.adds) pickups.set(a.playerId, (pickups.get(a.playerId) ?? 0) + 1);
  const rows = countBoard(ctx, scoped.flatMap(({ year, tx }) => tx.drops.map((d) => ({ playerId: d.playerId, year, created: tx.created, group: d.userId }))), () => '');
  return rows.map((r) => ({ ...r, detail: `picked up ${plural(pickups.get(r.playerId) ?? 0, 'time')}` }));
};

const claims = (ctx: BoardContext): WaiverClaim[] => waiverClaims(ctx.transactions.filter((s) => inYear(ctx, s.year)), ctx.lines).filter((c) => posOk(ctx, c.playerId));
const claimRow = (c: WaiverClaim, value: number, label: string, detail: string): BoardRow =>
  ({ key: `${c.year}-${c.week}-${c.playerId}-${c.userId}`, playerId: c.playerId, value, valueLabel: label, meta: `${c.year} · Wk ${c.week}`, detail, userId: c.userId, to: null });

export const waiverHeroes = (ctx: BoardContext): BoardRow[] =>
  rank(claims(ctx).filter((c) => c.bid >= 1).map((c) => ({ c, playerId: c.playerId, value: c.points, latestYear: c.year, latestWeek: c.week })))
    .map(({ c }) => claimRow(c, c.points, fmtPts(c.points), `$${c.bid} · ${plural(c.starts, 'start')}`));

export const waiverVillains = (ctx: BoardContext): BoardRow[] =>
  rank(claims(ctx).filter((c) => c.bid >= 10).map((c) => ({ c, playerId: c.playerId, value: round1(c.bid / Math.max(c.points, 1)), latestYear: c.year, latestWeek: c.week })))
    .map(({ c, value }) => claimRow(c, value, `$${value.toFixed(1)}/pt`, `$${c.bid} · ${fmtPts(c.points)} pts · ${plural(c.starts, 'start')}`));
