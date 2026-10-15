import type { PlayerId, UserId } from '@fantasy-dash/core';
import type { PlayerLine } from './playerLines';
import type { SeasonTransactions } from './boards/shared';

export interface WaiverClaim { year: number; week: number; playerId: PlayerId; userId: UserId; bid: number; points: number; starts: number }

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * One entry per waiver claim with a bid. The claim's window runs from the claim week until the week
 * before the claiming manager next drops the player (any transaction type), or to season end.
 * Points and starts count that manager's started lines inside the window.
 */
export function waiverClaims(seasons: SeasonTransactions[], lines: PlayerLine[]): WaiverClaim[] {
  const out: WaiverClaim[] = [];
  for (const { year, transactions } of seasons) {
    const sorted = [...transactions].sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : 1));
    const yearLines = lines.filter((l) => l.year === year && l.started);
    for (const tx of sorted) {
      if (tx.type !== 'waiver' || tx.bid === null) continue;
      for (const add of tx.adds) {
        const drop = sorted.find((o) => o.created > tx.created && o.drops.some((d) => d.playerId === add.playerId && d.userId === add.userId));
        const end = drop ? drop.week - 1 : Infinity;
        const mine = yearLines.filter((l) => l.playerId === add.playerId && l.userId === add.userId && l.week >= tx.week && l.week <= end);
        out.push({ year, week: tx.week, playerId: add.playerId, userId: add.userId, bid: tx.bid, points: round2(mine.reduce((s, l) => s + l.points, 0)), starts: mine.length });
      }
    }
  }
  return out;
}
