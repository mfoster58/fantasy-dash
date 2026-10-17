import type { PlayerId, Season, UserId } from '@fantasy-dash/core';

export type Acquisition =
  | { kind: 'draft'; round: number; pickNo: number }
  | { kind: 'waiver' | 'free_agent' | 'trade' | 'commissioner'; week: number; bid: number | null };

interface Event { week: number; order: number; add: { owner: UserId; acq: Acquisition } | null; dropBy: UserId | null }

/**
 * Who held a player in a given week and how he was acquired, from the draft (week 0) and the transaction
 * log in created order. An add counts from its week. A drop is logged against the just-played week, so it
 * takes effect the week after: a start in the drop week was still the dropper's.
 */
export function ownership(season: Season): (playerId: PlayerId, userId: UserId, week: number) => Acquisition | null {
  const events = new Map<PlayerId, Event[]>();
  const push = (p: PlayerId, e: Event) => { const list = events.get(p) ?? []; list.push(e); events.set(p, list); };
  for (const pk of season.draft?.picks ?? []) push(pk.playerId, { week: 0, order: pk.pickNo, add: { owner: pk.userId, acq: { kind: 'draft', round: pk.round, pickNo: pk.pickNo } }, dropBy: null });
  const txs = [...season.transactions].sort((x, y) => x.week - y.week || x.created - y.created || (x.id < y.id ? -1 : 1));
  txs.forEach((t, i) => {
    const kind = t.type === 'waiver' || t.type === 'free_agent' || t.type === 'trade' ? t.type : 'commissioner';
    for (const d of t.drops) push(d.playerId, { week: t.week, order: 1000 + i, add: null, dropBy: d.userId });
    for (const a of t.adds) push(a.playerId, { week: t.week, order: 1000 + i + 0.5, add: { owner: a.userId, acq: { kind, week: t.week, bid: t.bid } }, dropBy: null });
  });
  for (const list of events.values()) list.sort((x, y) => x.week - y.week || x.order - y.order);
  return (playerId, userId, week) => {
    let owner: UserId | null = null, acq: Acquisition | null = null;
    for (const e of events.get(playerId) ?? []) {
      if (e.add) { if (e.week > week) break; owner = e.add.owner; acq = e.add.acq; }
      else if (e.dropBy === owner && e.week < week) { owner = null; acq = null; }
    }
    return owner === userId ? acq : null;
  };
}
