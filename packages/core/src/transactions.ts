import type { Transaction, TransactionMove, TransactionType, UserId } from './types';
import type { SleeperTransaction } from './sleeper/types';

const KNOWN: ReadonlySet<string> = new Set(['trade', 'waiver', 'free_agent']);

const typeOf = (t: string): TransactionType => (KNOWN.has(t) ? (t as TransactionType) : 'commissioner');

function moves(map: Record<string, number> | null, rosterToUser: Record<number, UserId>): TransactionMove[] {
  if (!map) return [];
  const out: TransactionMove[] = [];
  for (const [playerId, rosterId] of Object.entries(map)) {
    const userId = rosterToUser[rosterId];
    if (userId) out.push({ playerId, userId });
  }
  return out;
}

/** Completed transactions with rosters resolved to managers, oldest first (ties by id). Moves to unknown rosters are dropped; a transaction left with no moves is dropped. */
export function transactionsOf(raw: SleeperTransaction[], rosterToUser: Record<number, UserId>): Transaction[] {
  const out: Transaction[] = [];
  for (const t of raw) {
    if (t.status !== 'complete') continue;
    const adds = moves(t.adds, rosterToUser);
    const drops = moves(t.drops, rosterToUser);
    if (adds.length === 0 && drops.length === 0) continue;
    const type = typeOf(t.type);
    out.push({ id: t.transaction_id, type, week: t.leg, created: t.created, adds, drops, bid: type === 'waiver' ? t.settings?.waiver_bid ?? 0 : null });
  }
  return out.sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
