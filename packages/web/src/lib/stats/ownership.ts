import type { PlayerId, Season, UserId } from '@fantasy-dash/core';

export type Acquisition =
  | { kind: 'draft'; round: number; pickNo: number }
  | { kind: 'waiver' | 'free_agent' | 'trade' | 'commissioner'; week: number; bid: number | null };

/** one manager's spell with a player: from the add week until (exclusive) the week after the drop */
interface Holding { owner: UserId; acq: Acquisition; from: number; until: number }

/**
 * Who held a player in a given week and how he was acquired, from the draft (week 0) and the transaction
 * log in created order. An add counts from its week. A drop is logged against the just-played week, so it
 * takes effect the week after: a start in the drop week was still the dropper's. Spells are kept per
 * manager, so the week a player changes hands belongs to both sides and the start record says who used him.
 */
export function ownership(season: Season): (playerId: PlayerId, userId: UserId, week: number) => Acquisition | null {
  const holdings = new Map<PlayerId, Holding[]>();
  const of = (p: PlayerId) => { let list = holdings.get(p); if (!list) { list = []; holdings.set(p, list); } return list; };
  const add = (p: PlayerId, owner: UserId, acq: Acquisition, from: number) => {
    const list = of(p);
    for (const h of list) if (h.owner === owner && h.until === Infinity) h.until = from;
    list.push({ owner, acq, from, until: Infinity });
  };
  const drop = (p: PlayerId, owner: UserId, week: number) => {
    const list = of(p);
    for (let i = list.length - 1; i >= 0; i--) if (list[i].owner === owner && list[i].until === Infinity) { list[i].until = week + 1; break; }
  };
  for (const pk of [...(season.draft?.picks ?? [])].sort((x, y) => x.pickNo - y.pickNo)) add(pk.playerId, pk.userId, { kind: 'draft', round: pk.round, pickNo: pk.pickNo }, 0);
  const txs = [...season.transactions].sort((x, y) => x.week - y.week || x.created - y.created || (x.id < y.id ? -1 : 1));
  for (const t of txs) {
    const kind = t.type === 'waiver' || t.type === 'free_agent' || t.type === 'trade' ? t.type : 'commissioner';
    for (const d of t.drops) drop(d.playerId, d.userId, t.week);
    for (const a of t.adds) add(a.playerId, a.userId, { kind, week: t.week, bid: t.bid }, t.week);
  }
  return (playerId, userId, week) => holdings.get(playerId)?.find((h) => h.owner === userId && h.from <= week && week < h.until)?.acq ?? null;
}
