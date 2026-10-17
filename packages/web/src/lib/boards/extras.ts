import type { PlayerSeasonLine, Transaction, UserId } from '@fantasy-dash/core';
import { fmtPts, fmtSigned } from '../format';
import type { PlayerLine } from '../playerLines';
import { longestStartRun } from '../ironman';
import { isFlop, waiverClaims, type WaiverClaim } from '../waivers';
import type { BoardContext, BoardRow, Direction, DraftValue } from './shared';
import { KICKING_DEF, careerBoard, fmt1, groupBy, inYear, intLabel, metaOf, momentBoard, plural, posOk, rank, round1, skillOnly, started, sum, toneOf } from './shared';

const txInScope = (ctx: BoardContext): { year: number; tx: Transaction }[] =>
  ctx.transactions.filter((s) => inYear(ctx, s.year)).flatMap((s) => s.transactions.map((tx) => ({ year: s.year, tx })));
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
  // a run can only be live when the lines reach the current season
  const mayBeActive = ctx.year === null || ctx.year === ctx.currentYear;
  const items = [...runs.entries()].map(([playerId, r]) => ({ playerId, value: r.length, run: r, latestYear: r.to.year, latestWeek: r.to.week }));
  return rank(items).map((i) => ({
    key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: String(i.value),
    meta: `${i.run.from.year} Wk ${i.run.from.week} – ${i.run.to.year} Wk ${i.run.to.week}`, detail: mayBeActive && i.run.active ? 'active' : null, userId: null, to: null,
  }));
};

export const boomStarts = (ctx: BoardContext): BoardRow[] =>
  careerBoard(started(ctx), (ls) => ls.filter((l) => l.points >= 30).length, intLabel, (ls) => plural(ls.length, 'start'), metaOf(ctx));
export const dudStarts = (ctx: BoardContext): BoardRow[] =>
  careerBoard(skillOnly(started(ctx)), (ls) => ls.filter((l) => l.played && l.points < 5).length, intLabel, (ls) => plural(ls.length, 'start'), metaOf(ctx));
export const journeyman = (ctx: BoardContext): BoardRow[] =>
  careerBoard(skillOnly(started(ctx)), (ls) => new Set(ls.map((l) => l.userId)).size, intLabel, (ls) => plural(ls.length, 'start'), metaOf(ctx));


/** Rows from per-player event counts; ties fall to the most recent event. */
function countBoard(ctx: BoardContext, events: { playerId: string; year: number; created: number }[]): BoardRow[] {
  const by = new Map<string, { n: number; years: Set<number>; latest: number }>();
  for (const e of events) {
    if (!posOk(ctx, e.playerId)) continue;
    const g = by.get(e.playerId) ?? { n: 0, years: new Set<number>(), latest: 0 };
    g.n += 1; g.years.add(e.year); g.latest = Math.max(g.latest, e.created);
    by.set(e.playerId, g);
  }
  const items = [...by.entries()].map(([playerId, g]) => ({ playerId, value: g.n, g, latestYear: Math.max(...g.years), latestWeek: 0, secondary: g.latest }));
  return rank(items).map((i) => ({ key: i.playerId, playerId: i.playerId, value: i.value, valueLabel: String(i.value), meta: seasonsMeta(ctx, i.g.years), detail: null, userId: null, to: null }));
}

export const fodder = (ctx: BoardContext): BoardRow[] => {
  const scoped = txInScope(ctx);
  const pickups = new Map<string, number>();
  for (const { tx } of scoped) if (tx.type !== 'trade') for (const a of tx.adds) pickups.set(a.playerId, (pickups.get(a.playerId) ?? 0) + 1);
  const skill = (playerId: string) => !KICKING_DEF.has(ctx.players[playerId]?.position ?? '');
  const rows = countBoard(ctx, scoped.flatMap(({ year, tx }) => tx.drops.filter((d) => skill(d.playerId)).map((d) => ({ playerId: d.playerId, year, created: tx.created }))));
  return rows.map((r) => ({ ...r, detail: `picked up ${plural(pickups.get(r.playerId ?? '') ?? 0, 'time')}` }));
};

const claims = (ctx: BoardContext): WaiverClaim[] => waiverClaims(ctx.transactions.filter((s) => inYear(ctx, s.year)), ctx.lines).filter((c) => posOk(ctx, c.playerId));
const claimRow = (c: WaiverClaim, value: number, label: string, detail: string): BoardRow =>
  ({ key: `${c.year}-${c.week}-${c.playerId}-${c.userId}`, playerId: c.playerId, value, valueLabel: label, meta: `${c.year} · Wk ${c.week}`, detail, userId: c.userId, to: null });

const bidLabel = (c: WaiverClaim) => (c.bid === null ? 'FA' : `$${c.bid}`);

/** Every pickup, waiver or free agent, by the started points it returned. */
export const waiverHeroes = (ctx: BoardContext): BoardRow[] =>
  rank(claims(ctx).map((c) => ({ c, playerId: c.playerId, value: c.points, latestYear: c.year, latestWeek: c.week })))
    .map(({ c }) => claimRow(c, c.points, fmtPts(c.points), `${bidLabel(c)} · ${plural(c.starts, 'start')}`));

/** Bids whose player returned under FLOP_POINTS started points once his stint was over, the biggest bid first. */
export const waiverFlops = (ctx: BoardContext): BoardRow[] =>
  rank(claims(ctx).filter(isFlop).map((c) => ({ c, playerId: c.playerId, value: c.bid, latestYear: c.year, latestWeek: c.week })))
    .map(({ c, value }) => claimRow(c, value, `$${value}`, `${fmtPts(c.points)} pts · ${plural(c.starts, 'start')}`));

const SKILL = new Set(['QB', 'RB', 'WR', 'TE']);
const slot = (p: { round: number; pickNo: number }) => `Rd ${p.round}, pick ${p.pickNo}`;

/** The chosen season's draft values, or under All-time each player's best single season (worst under −). */
export const draftValue = (ctx: BoardContext, direction: Direction = 'desc'): BoardRow[] => {
  const scoped = ctx.picks.filter((p) => inYear(ctx, p.year) && posOk(ctx, p.playerId));
  const better = direction === 'asc' ? (a: number, b: number) => a < b : (a: number, b: number) => a > b;
  const best = new Map<string, DraftValue>();
  for (const p of scoped) {
    const cur = best.get(p.playerId);
    if (!cur || better(p.value, cur.value) || (p.value === cur.value && p.year > cur.year)) best.set(p.playerId, p);
  }
  const items = [...best.values()].map((p) => ({ p, playerId: p.playerId, value: round1(p.value), latestYear: p.year, latestWeek: 0 }));
  return rank(items, direction).map(({ p, value }) => ({ key: `${p.year}-${p.playerId}`, playerId: p.playerId, value, valueLabel: fmtSigned(value, 1), meta: String(p.year), detail: slot(p), userId: null, to: null, tone: toneOf(value) }));
};

/** The last QB/RB/WR/TE pick of each draft and what he scored that season; under a position filter, the last pick at that position. */
export const mrIrrelevant = (ctx: BoardContext): BoardRow[] => {
  const items: { playerId: string; value: number; year: number; detail: string; userId: UserId; latestYear: number; latestWeek: number }[] = [];
  const eligible = (playerId: string) => (ctx.pos === 'All' ? SKILL.has(ctx.players[playerId]?.position ?? '') : posOk(ctx, playerId));
  const note = ctx.pos === 'All' ? '' : ` · last ${ctx.pos === 'FLEX' ? 'RB, WR or TE' : ctx.pos} drafted`;
  for (const [y, draft] of Object.entries(ctx.drafts)) {
    const year = Number(y);
    if (!draft || !inYear(ctx, year)) continue;
    const last = [...draft.picks].filter((p) => eligible(p.playerId)).sort((a, b) => b.pickNo - a.pickNo)[0];
    if (!last) continue;
    const line = ctx.playerSeasons[year]?.[last.playerId];
    const pos = ctx.players[last.playerId]?.position ?? '?';
    const finish = line && line.games > 0 ? `${pos}${line.posRank ?? '?'} · ${fmt1(line.points / line.games)} ppg` : '—';
    items.push({ playerId: last.playerId, value: line?.points ?? 0, year, detail: `${finish} · ${slot(last)}${note}`, userId: last.userId, latestYear: year, latestWeek: 0 });
  }
  return rank(items).map((i) => ({ key: `${i.year}-${i.playerId}`, playerId: i.playerId, value: i.value, valueLabel: fmtPts(i.value), meta: String(i.year), detail: i.detail, userId: i.userId, to: `/draft/${i.year}` }));
};

const MIN_PAIR_GAMES = 10;
export const pairEmpty = (): string => `No players with ${MIN_PAIR_GAMES} games in both seasons yet.`;
interface Pair { playerId: string; from: number; to: number; prev: PlayerSeasonLine; next: PlayerSeasonLine; delta: number }
/** Consecutive-season pairs for skill players with enough games in both; a chosen year is the later season. */
function seasonPairs(ctx: BoardContext): Pair[] {
  const years = Object.keys(ctx.playerSeasons).map(Number).sort((a, b) => a - b);
  const out: Pair[] = [];
  for (const to of years) {
    const prevSeason = ctx.playerSeasons[to - 1];
    if (!inYear(ctx, to) || !prevSeason) continue;
    for (const [playerId, next] of Object.entries(ctx.playerSeasons[to])) {
      const prev = prevSeason[playerId];
      if (!prev || prev.games < MIN_PAIR_GAMES || next.games < MIN_PAIR_GAMES) continue;
      const pos = ctx.players[playerId]?.position ?? '';
      if (!SKILL.has(pos) || !posOk(ctx, playerId)) continue;
      out.push({ playerId, from: to - 1, to, prev, next, delta: round1(next.points / next.games - prev.points / prev.games) });
    }
  }
  return out;
}
const pairRow = (ctx: BoardContext) => (p: Pair): BoardRow => {
  const pos = ctx.players[p.playerId]?.position ?? '?';
  const fin = (l: PlayerSeasonLine) => `${pos}${l.posRank ?? '?'} · ${fmt1(l.points / l.games)} ppg`;
  return { key: `${p.to}-${p.playerId}`, playerId: p.playerId, value: p.delta, valueLabel: fmtSigned(p.delta, 1), meta: `${p.from} → ${p.to}`, detail: `${fin(p.prev)} → ${fin(p.next)} · ${fmtPts(p.next.points)} pts`, userId: null, to: null, tone: toneOf(p.delta) };
};
export const breakout = (ctx: BoardContext): BoardRow[] =>
  rank(seasonPairs(ctx).filter((p) => p.delta > 0).map((p) => ({ p, playerId: p.playerId, value: p.delta, latestYear: p.to, latestWeek: 0 }))).map(({ p }) => pairRow(ctx)(p));
export const fallOff = (ctx: BoardContext): BoardRow[] =>
  rank(seasonPairs(ctx).filter((p) => p.delta < 0).map((p) => ({ p, playerId: p.playerId, value: p.delta, latestYear: p.to, latestWeek: 0 })), 'asc').map(({ p }) => pairRow(ctx)(p));
