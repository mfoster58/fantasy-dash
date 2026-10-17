import type { PlayerId, UserId } from '@fantasy-dash/core';
import type { PlayerLine } from './playerLines';
import type { SeasonTransactions } from './boards/shared';

/**
 * `bid` is null for a free-agent add; `lines` are the claimer's started lines inside the window, in week order.
 * `open` is true while the player is still on the claimer's roster in a season that is not complete: the pickup is not judged yet.
 */
export interface WaiverClaim { year: number; week: number; playerId: PlayerId; userId: UserId; bid: number | null; points: number; starts: number; lines: PlayerLine[]; open: boolean }

/** started points under which a bid is a flop; at or above it the bid hit */
export const FLOP_POINTS = 10;
const paid = (c: WaiverClaim): c is WaiverClaim & { bid: number } => c.bid !== null && c.bid > 0;
/** a paid bid that has returned FLOP_POINTS, on an open claim or a closed one: a hit is a hit as soon as it happens */
export const isHit = (c: WaiverClaim): boolean => paid(c) && c.points >= FLOP_POINTS;
/** a paid bid under FLOP_POINTS once its stint is over; an open claim is never a flop, the player may still come good */
export const isFlop = (c: WaiverClaim): c is WaiverClaim & { bid: number } => paid(c) && !c.open && c.points < FLOP_POINTS;
/** a bid that can be called a hit or a flop */
export const judged = (c: WaiverClaim): c is WaiverClaim & { bid: number } => paid(c) && (c.points >= FLOP_POINTS || !c.open);

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * One entry per pickup: a waiver claim with a bid, or a free-agent add with none. The window runs from
 * the pickup week through the week in which the picking manager next drops the player (any transaction
 * type; Sleeper keeps a drop's week at the just-played week until lineups lock again, so a start in that
 * week was still the picker's), or to season end. Points and starts count that manager's started lines
 * inside the window. A pickup whose window holds no scored league week (processed after the last scored
 * week) is left out.
 */
export function waiverClaims(seasons: SeasonTransactions[], lines: PlayerLine[]): WaiverClaim[] {
  const out: WaiverClaim[] = [];
  for (const { year, transactions, complete = true } of seasons) {
    const sorted = [...transactions].sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : 1));
    const scoredWeeks = new Set(lines.filter((l) => l.year === year).map((l) => l.week));
    const yearLines = lines.filter((l) => l.year === year && l.started);
    // where the manager's previous claim of the same player ended: a re-add's window starts after it, so no start is counted twice
    const windowEnd = new Map<string, number>();
    for (const tx of sorted) {
      if (!(tx.type === 'waiver' && tx.bid !== null) && tx.type !== 'free_agent') continue;
      for (const add of tx.adds) {
        const drop = sorted.find((o) => o.created > tx.created && o.drops.some((d) => d.playerId === add.playerId && d.userId === add.userId));
        const end = drop ? drop.week : Infinity;
        const key = `${add.userId}|${add.playerId}`;
        const start = Math.max(tx.week, (windowEnd.get(key) ?? -Infinity) + 1);
        windowEnd.set(key, end);
        if (![...scoredWeeks].some((w) => w >= tx.week && w <= end)) continue;
        const mine = yearLines.filter((l) => l.playerId === add.playerId && l.userId === add.userId && l.week >= start && l.week <= end).sort((a, b) => a.week - b.week);
        out.push({ year, week: tx.week, playerId: add.playerId, userId: add.userId, bid: tx.type === 'waiver' ? tx.bid : null, points: round2(mine.reduce((s, l) => s + l.points, 0)), starts: mine.length, lines: mine, open: !drop && !complete });
      }
    }
  }
  return out;
}
