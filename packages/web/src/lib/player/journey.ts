import type { PlayerDirectory, PlayerId, Season, UserId } from '@fantasy-dash/core';
import type { PlayerLine } from '../playerLines';
import { playerName } from '../players';

export type MoveKind = 'drafted' | 'kept' | 'traded' | 'waiver' | 'freeAgent' | 'dropped' | 'commissioner';
/** week 0 is the draft */
export interface At { year: number; week: number }
export interface Move { kind: MoveKind; at: At; created: number; text: string }
export interface Stint { userId: UserId; teamName: string; lastYear: number; from: At; to: At | null; starts: number; pts: number; perStart: number | null; w: number; l: number; t: number; title: boolean; moves: Move[] }

interface Ev extends Move { userId: UserId; acquire: boolean }
interface Span { userId: UserId; from: At; to: At | null; moves: Move[] }

const cmp = (a: At, b: At) => a.year - b.year || a.week - b.week;
export const whenLabel = (at: At): string => (at.week === 0 ? `${at.year} draft` : `${at.year} Wk ${at.week}`);
export const stintRange = (s: Stint): string => `${whenLabel(s.from)} → ${s.to ? whenLabel(s.to) : 'now'}`;
const lastWeekOf = (s: Season) => Math.max(0, ...s.weeks.filter((w) => w.played).map((w) => w.week));

/** Every draft pick, keeper and transaction that moved him, oldest first; a trade is one acquire event for the receiver. */
function eventsOf(seasons: Season[], players: PlayerDirectory, id: PlayerId): Ev[] {
  const out: Ev[] = [];
  for (const s of seasons) {
    const name = (u: UserId) => s.managers[u]?.displayName ?? u;
    for (const p of s.draft?.picks ?? []) {
      if (p.playerId !== id) continue;
      out.push({ at: { year: s.year, week: 0 }, created: 0, kind: p.isKeeper ? 'kept' : 'drafted', userId: p.userId, acquire: true, text: p.isKeeper ? `Kept at an R${p.round} price` : `Drafted R${p.round} #${p.pickNo}` });
    }
    for (const t of s.transactions) {
      const at = { year: s.year, week: t.week };
      const add = t.adds.find((m) => m.playerId === id);
      const drop = t.drops.find((m) => m.playerId === id);
      if (t.type === 'trade' && add) {
        const from = drop?.userId;
        const got = from ? t.adds.filter((m) => m.userId === from).map((m) => playerName(players, m.playerId)) : [];
        out.push({ at, created: t.created, kind: 'traded', userId: add.userId, acquire: true, text: from ? `Traded from ${name(from)}${got.length ? `, who got ${got.join(' + ')}` : ''}` : 'Traded' });
        continue;
      }
      if (drop) out.push({ at, created: t.created, kind: t.type === 'commissioner' ? 'commissioner' : 'dropped', userId: drop.userId, acquire: false, text: t.type === 'commissioner' ? 'Moved by the commissioner' : 'Dropped' });
      if (add) {
        const kind: MoveKind = t.type === 'waiver' ? 'waiver' : t.type === 'free_agent' ? 'freeAgent' : 'commissioner';
        const text = kind === 'waiver' ? `Waiver claim${t.bid ? ` · $${t.bid} FAAB` : ''}` : kind === 'freeAgent' ? 'Free-agent add' : 'Moved by the commissioner';
        // after a drop in the same transaction
        out.push({ at, created: t.created + 0.5, kind, userId: add.userId, acquire: true, text });
      }
    }
  }
  return out.sort((a, b) => cmp(a.at, b.at) || a.created - b.created);
}

/** Every unbroken spell on one roster, newest first, with the moves that opened and closed it. */
export function journeyOf(lines: PlayerLine[], seasons: Season[], players: PlayerDirectory, id: PlayerId): Stint[] {
  if (!lines.length) return [];
  const sorted = [...seasons].sort((a, b) => a.year - b.year);
  const newest = sorted[sorted.length - 1].year;
  const evs = eventsOf(sorted, players, id);
  const done: Span[] = [];
  let open: Span | null = null;
  const close = (to: At) => { if (open) { done.push({ ...open, to }); open = null; } };
  const asMove = (e: Ev): Move => ({ kind: e.kind, at: e.at, created: e.created, text: e.text });

  for (const s of sorted) {
    const carried: Span | null = open;
    if (carried && carried.from.year < s.year) {
      // a roster carries over only on a keeper pick, or in a season with no draft while he is still on that roster
      const kept = s.draft?.picks.some((p) => p.playerId === id && p.isKeeper && p.userId === carried.userId) ?? false;
      const stayed = !s.draft && lines.some((l) => l.year === s.year && l.userId === carried.userId);
      const prev = sorted[sorted.indexOf(s) - 1];
      if (!kept && !stayed && prev) close({ year: prev.year, week: lastWeekOf(prev) });
    }
    for (const e of evs.filter((x) => x.at.year === s.year)) {
      const cur: Span | null = open;
      if (!e.acquire) {
        if (cur && cur.userId === e.userId) { cur.moves.push(asMove(e)); close(e.at); }
        continue;
      }
      if (cur && cur.userId === e.userId) { cur.moves.push(asMove(e)); continue; }
      if (cur) close(e.at);
      // a re-add in the very week of the drop reopens the stint it closed
      const last = done[done.length - 1];
      const lastMove = last?.moves[last.moves.length - 1];
      if (last && last.userId === e.userId && lastMove?.kind === 'dropped' && cmp(lastMove.at, e.at) === 0) {
        done.pop();
        open = { userId: last.userId, from: last.from, to: null, moves: [...last.moves, asMove(e)] };
        continue;
      }
      open = { userId: e.userId, from: e.at, to: null, moves: [asMove(e)] };
    }
  }
  const tail: Span | null = open;
  if (tail) {
    const stillThere = tail.from.year === newest || lines.some((l) => l.year === newest && l.userId === tail.userId);
    if (stillThere) done.push({ ...tail, to: null });
    else {
      const lastYear = Math.max(...lines.filter((l) => l.userId === tail.userId).map((l) => l.year));
      const s = sorted.find((x) => x.year === lastYear)!;
      done.push({ ...tail, to: { year: s.year, week: lastWeekOf(s) } });
    }
  }

  const inside = (l: PlayerLine, d: Span) => { const at = { year: l.year, week: l.week }; return cmp(at, d.from) >= 0 && (d.to === null || cmp(at, d.to) <= 0); };
  const atOf = (l: PlayerLine): At => ({ year: l.year, week: l.week });
  const byWeek = [...lines].sort((a, b) => a.year - b.year || a.week - b.week);
  // A move's leg is not the roster boundary: a waiver claim can first play the next week and a drop can come after that
  // week's game. The weeks he spent on the roster date each stint; the move's own week stands in when there are none.
  for (const d of done) {
    const mine = byWeek.filter((l) => l.userId === d.userId && inside(l, d));
    if (d.from.week !== 0 && mine.length) d.from = atOf(mine[0]);
    if (d.to) d.to = mine.length ? atOf(mine[mine.length - 1]) : d.from;
  }
  // a spell on a roster that no recorded move explains still gets its own stint
  for (const l of byWeek) {
    if (done.some((d) => d.userId === l.userId && inside(l, d))) continue;
    const last = done.find((d) => d.moves.length === 0 && d.userId === l.userId && d.to && cmp(d.to, atOf(l)) < 0 && !byWeek.some((o) => cmp(atOf(o), d.to!) > 0 && cmp(atOf(o), atOf(l)) < 0));
    if (last) last.to = atOf(l); else done.push({ userId: l.userId, from: atOf(l), to: atOf(l), moves: [] });
  }
  const newestLast = { year: newest, week: lastWeekOf(sorted[sorted.length - 1]) };
  for (const d of done) if (d.moves.length === 0 && d.to && cmp(d.to, newestLast) === 0) d.to = null;

  return done.map((d) => {
    const mine = lines.filter((l) => !l.consolation && l.userId === d.userId && inside(l, d));
    const started = mine.filter((l) => l.started);
    const pts = started.reduce((n, l) => n + l.points, 0);
    const lastYear = d.to?.year ?? newest;
    const champYears = new Set(sorted.filter((s) => s.honors.champion === d.userId).map((s) => s.year));
    const m = sorted.find((s) => s.year === lastYear)?.managers[d.userId];
    return {
      userId: d.userId, teamName: m?.teamName ?? m?.displayName ?? d.userId, lastYear, from: d.from, to: d.to,
      starts: started.length, pts, perStart: started.length ? pts / started.length : null,
      w: started.filter((l) => l.result === 'W').length, l: started.filter((l) => l.result === 'L').length, t: started.filter((l) => l.result === 'T').length,
      title: mine.some((l) => l.postseason && champYears.has(l.year)),
      moves: [...d.moves].sort((a, b) => cmp(b.at, a.at) || b.created - a.created),
    };
  }).sort((a, b) => cmp(b.from, a.from));
}
