import type { Draft, DraftPick, ExpectedCurve, PlayerDirectory, PlayerId, UserId } from './types';
import type { SleeperDraft, SleeperDraftPick, SleeperTransaction } from './sleeper/types';
import { round2, round4 } from './scoring';

/** Last startable rank per position in a 10-team league with 2 RB, 2 WR, 1 TE, 2 FLEX, 1 QB, 1 K. Defenses are excluded from value math. */
export const BASELINE_RANKS: Record<string, number> = { QB: 10, RB: 24, WR: 24, TE: 12, K: 10 };

/** e-folding length of the draft capital curve, in picks. */
export const CAPITAL_DECAY = 45;

/** Draft capital of a pick slot: 100 at pick 1, ~27 at pick 60, ~3 at pick 160. */
export function capital(pick: number): number {
  return 100 * Math.exp(-(pick - 1) / CAPITAL_DECAY);
}

export function expectedAt(curve: ExpectedCurve, pick: number): number {
  return curve.a * Math.exp(-(pick - 1) / curve.k);
}

/**
 * Least-squares fit of a·exp(−(pick−1)/k) to (pick, contribution). k is searched over the integers
 * 10..120; a is closed-form at each k. Null when there are fewer than 2 points or every contribution is 0.
 */
export function fitExpectedCurve(points: { pick: number; contribution: number }[]): ExpectedCurve | null {
  if (points.length < 2 || points.every((p) => p.contribution === 0)) return null;
  let best: { a: number; k: number; err: number } | null = null;
  for (let k = 10; k <= 120; k++) {
    let num = 0;
    let den = 0;
    for (const p of points) {
      const x = Math.exp(-(p.pick - 1) / k);
      num += x * p.contribution;
      den += x * x;
    }
    const a = num / den;
    let err = 0;
    for (const p of points) err += (p.contribution - a * Math.exp(-(p.pick - 1) / k)) ** 2;
    if (!best || err < best.err) best = { a, k, err };
  }
  return best ? { a: round4(best.a), k: best.k } : null;
}

export interface PlayerTrade { playerId: PlayerId; toUserId: UserId; week: number; created: number }

export interface DraftValueInput {
  /** season points under league scoring for every NFL player with stats */
  seasonPoints: Record<PlayerId, number>;
  players: PlayerDirectory;
  /** scored weeks in which the player had gp >= 1 */
  gamesPlayed: Record<PlayerId, number>;
  /** scored weeks in which any player on the NFL team had gp >= 1 */
  teamGames: Record<string, number>;
  lastScoredWeek: number;
  /** regular season + playoff weeks */
  totalWeeks: number;
  trades: PlayerTrade[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Completed trades, one entry per player moved, with the receiving roster resolved to a user. */
export function tradesFromTransactions(transactions: SleeperTransaction[], rosterToUser: Record<number, UserId>): PlayerTrade[] {
  const out: PlayerTrade[] = [];
  for (const t of transactions) {
    if (t.type !== 'trade' || t.status !== 'complete' || !t.adds) continue;
    for (const [playerId, rosterId] of Object.entries(t.adds)) {
      out.push({ playerId, toUserId: rosterToUser[rosterId] ?? `roster-${rosterId}`, week: t.leg, created: t.created });
    }
  }
  return out;
}

/**
 * Fill every derived field on the picks. Pure.
 *
 * Points over baseline: per valued position (BASELINE_RANKS keys), the pool is every directory
 * player at that position with points > 0, sorted desc; the baseline is the pool entry at
 * BASELINE_RANKS[pos] (0 if the pool is shorter). Redraft position ranks all valued-position
 * players with points > 0 by PoB desc (ties: points desc, id asc); zero scorers tie at N + 1.
 * Slot value is draft capital gained; production value is contribution over the fitted expected
 * curve, on a full-season pace. DEF and unknown positions get null for every value field.
 * Before the first scored week every value field is null.
 */
export function computeDraftValues(picks: DraftPick[], input: DraftValueInput): { picks: DraftPick[]; expectedCurve: ExpectedCurve | null } {
  const posOf = (id: PlayerId) => input.players[id]?.position ?? null;
  const valued = (pos: string | null): pos is string => pos !== null && BASELINE_RANKS[pos] !== undefined;
  const pts = (id: PlayerId) => input.seasonPoints[id] ?? 0;
  const scored = input.lastScoredWeek > 0;

  // Baseline points per valued position.
  const byPos = new Map<string, PlayerId[]>();
  for (const id of Object.keys(input.players)) {
    const pos = posOf(id);
    if (!valued(pos)) continue;
    const list = byPos.get(pos) ?? [];
    list.push(id);
    byPos.set(pos, list);
  }
  const baselinePoints = new Map<string, number>();
  for (const [pos, all] of byPos) {
    const scorers = all.filter((id) => pts(id) > 0).sort((a, b) => pts(b) - pts(a) || (a < b ? -1 : a > b ? 1 : 0));
    const baseId = scorers[BASELINE_RANKS[pos] - 1];
    baselinePoints.set(pos, baseId ? pts(baseId) : 0);
  }
  const pobOf = (id: PlayerId): number => round2(pts(id) - (baselinePoints.get(posOf(id) ?? '') ?? 0));

  // Redraft order across positions.
  const redraft = new Map<PlayerId, number>();
  const scorers = [...byPos.values()].flat().filter((id) => pts(id) > 0)
    .sort((a, b) => pobOf(b) - pobOf(a) || pts(b) - pts(a) || (a < b ? -1 : a > b ? 1 : 0));
  scorers.forEach((id, i) => redraft.set(id, i + 1));
  const lastPos = scorers.length + 1;

  // Latest trade per player.
  const tradedTo = new Map<PlayerId, { userId: UserId; week: number; created: number }>();
  for (const t of input.trades) {
    const cur = tradedTo.get(t.playerId);
    if (!cur || t.created > cur.created) tradedTo.set(t.playerId, { userId: t.toUserId, week: t.week, created: t.created });
  }

  const ordered = [...picks].sort((a, b) => a.pickNo - b.pickNo);
  const seen = new Map<string, number>();
  const base = ordered.map((p) => {
    const pos = posOf(p.playerId);
    const seasonPoints = round2(pts(p.playerId));
    const gamesPlayed = input.gamesPlayed[p.playerId] ?? 0;
    const team = input.players[p.playerId]?.team ?? null;
    const teamGames = team ? input.teamGames[team] ?? 0 : 0;
    const traded = tradedTo.get(p.playerId);
    const common = {
      ...p,
      seasonPoints,
      gamesPlayed,
      ppg: gamesPlayed > 0 ? round2(seasonPoints / gamesPlayed) : null,
      healthy: gamesPlayed > 0 && team !== null && gamesPlayed >= teamGames,
      tradedTo: traded ? { userId: traded.userId, week: traded.week } : null,
      pointsOverBaseline: null as number | null,
      redraftPos: null as number | null,
      slotValue: null as number | null,
      productionValue: null as number | null,
      value: null as number | null,
    };
    if (!valued(pos)) return { ...common, posDraftRank: null };
    const posDraftRank = (seen.get(pos) ?? 0) + 1;
    seen.set(pos, posDraftRank);
    if (!scored) return { ...common, posDraftRank };
    const redraftPos = redraft.get(p.playerId) ?? lastPos;
    return {
      ...common,
      posDraftRank,
      pointsOverBaseline: pobOf(p.playerId),
      redraftPos,
      slotValue: round1(capital(redraftPos) - capital(p.pickNo)),
    };
  });

  if (!scored) return { picks: base, expectedCurve: null };

  const contribution = (p: DraftPick) => Math.max(p.pointsOverBaseline ?? 0, 0);
  const curve = fitExpectedCurve(base.filter((p) => p.pointsOverBaseline !== null).map((p) => ({ pick: p.pickNo, contribution: contribution(p) })));
  const pace = input.totalWeeks / input.lastScoredWeek;
  const finished = base.map((p) => {
    if (p.pointsOverBaseline === null) return p;
    const expected = curve ? expectedAt(curve, p.pickNo) : 0;
    const productionValue = round1((contribution(p) - expected) * pace);
    return { ...p, productionValue, value: round1((p.slotValue ?? 0) + productionValue) };
  });
  return { picks: finished, expectedCurve: curve };
}

/** Normalize a Sleeper draft. Pickers come from `picked_by`, else the roster owner. */
export function buildDraft(draft: SleeperDraft, rawPicks: SleeperDraftPick[], rosterToUser: Record<number, UserId>, value: DraftValueInput): Draft {
  const pickerOf = (p: SleeperDraftPick): UserId =>
    p.picked_by ?? (p.roster_id != null ? rosterToUser[p.roster_id] ?? `roster-${p.roster_id}` : 'unknown');

  const basePicks: DraftPick[] = [...rawPicks]
    .sort((a, b) => a.pick_no - b.pick_no)
    .map((p) => ({
      round: p.round, pickNo: p.pick_no, slot: p.draft_slot, userId: pickerOf(p), playerId: p.player_id, isKeeper: p.is_keeper === true,
      posDraftRank: null, seasonPoints: 0, gamesPlayed: 0, ppg: null, healthy: false,
      pointsOverBaseline: null, redraftPos: null, slotValue: null, productionValue: null, value: null, tradedTo: null,
    }));
  const { picks, expectedCurve } = computeDraftValues(basePicks, value);

  let slotOrder: UserId[];
  if (draft.draft_order && Object.keys(draft.draft_order).length > 0) {
    slotOrder = Object.entries(draft.draft_order).sort((a, b) => a[1] - b[1]).map(([userId]) => userId);
  } else {
    slotOrder = picks.filter((p) => p.round === 1).sort((a, b) => a.slot - b.slot).map((p) => p.userId);
  }

  return { draftId: draft.draft_id, type: draft.type, rounds: draft.settings.rounds, slotOrder, picks, expectedCurve };
}
