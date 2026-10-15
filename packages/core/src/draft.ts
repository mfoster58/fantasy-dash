import type { Draft, DraftPick, ExpectedCurve, PlayerDirectory, PlayerId, PositionBaseline, UserId } from './types';
import type { SleeperDraft, SleeperDraftPick, SleeperTransaction } from './sleeper/types';
import { round2, round4 } from './scoring';

/** Last startable rank per position in a 10-team league with 2 RB, 2 WR, 1 TE, 2 FLEX, 1 QB. Kickers and defenses are excluded from value math (streamed, not drafted for value). */
export const BASELINE_RANKS: Record<string, number> = { QB: 10, RB: 24, WR: 24, TE: 12 };

/** Roster-able depth per position. Production below this line is floored: a player nobody would keep on a bench is simply worthless, not infinitely bad. */
export const BENCH_RANKS: Record<string, number> = { QB: 14, RB: 40, WR: 40, TE: 16 };

/**
 * Scarcity weight applied to points over baseline before ranking and valuing. A one-QB lineup with deep
 * replacement makes a QB point worth less than an RB/WR point; 0.5 matches where the league's next-year
 * ADP actually places top quarterbacks. Positions not listed weigh 1.
 */
export const POSITION_WEIGHTS: Record<string, number> = { QB: 0.5 };

/** e-folding length of the draft capital curve, in picks. */
export const CAPITAL_DECAY = 35;

/** Draft capital of a pick slot: 100 at pick 1, ~19 at pick 60, ~1 at pick 160. */
export function capital(pick: number): number {
  return 100 * Math.exp(-(pick - 1) / CAPITAL_DECAY);
}

/** The most capital an earned pick before 1 can add on top of pick 1's 100. */
export const TOP_BONUS = 50;
/** e-folding length, in picks before 1, over which TOP_BONUS is approached. */
export const TOP_BONUS_DECAY = 25;

/**
 * Capital an earned pick is worth. On the board (pick >= 1) it is the slot's capital. Before pick 1 the capital
 * stops compounding: it is 100 plus a bonus that approaches TOP_BONUS as the earned pick moves further ahead
 * of 1, so a season that beats pick 1's expectation by a mile is worth at most 100 + TOP_BONUS. Off the board
 * (null) is worth 0.
 */
export function earnedCapital(earnedPick: number | null): number {
  if (earnedPick === null) return 0;
  if (earnedPick >= 1) return capital(earnedPick);
  return 100 + TOP_BONUS * (1 - Math.exp(-(1 - earnedPick) / TOP_BONUS_DECAY));
}

export function expectedAt(curve: ExpectedCurve, pick: number): number {
  return curve.a * Math.exp(-(pick - 1) / curve.k) + curve.c;
}

/**
 * The expected curve run backwards: the pick at which `contribution` is typically found. Below 1 for a player who
 * out-produces what pick 1 usually returns. Null when the contribution is at or below the curve's floor `c`
 * (off the board) or the fit is degenerate (a <= 0).
 */
export function earnedPickFor(curve: ExpectedCurve, contribution: number): number | null {
  if (curve.a <= 0) return null;
  const ratio = (contribution - curve.c) / curve.a;
  if (ratio <= 0) return null;
  return 1 - curve.k * Math.log(ratio);
}

/**
 * Least-squares fit of a·exp(−(pick−1)/k) + c to (pick, contribution). k is searched over the integers
 * 10..120; a and c are closed-form (simple linear regression on x = exp(−(pick−1)/k)) at each k. The
 * offset lets late-pick expectation go below replacement. Null when there are fewer than 2 points or
 * every contribution is 0.
 */
export function fitExpectedCurve(points: { pick: number; contribution: number }[]): ExpectedCurve | null {
  if (points.length < 2 || points.every((p) => p.contribution === 0)) return null;
  const n = points.length;
  let best: { a: number; k: number; c: number; err: number } | null = null;
  for (let k = 10; k <= 120; k++) {
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (const p of points) {
      const x = Math.exp(-(p.pick - 1) / k);
      sx += x;
      sy += p.contribution;
      sxx += x * x;
      sxy += x * p.contribution;
    }
    const den = n * sxx - sx * sx;
    if (den === 0) continue;
    const a = (n * sxy - sx * sy) / den;
    const c = (sy - a * sx) / n;
    let err = 0;
    for (const p of points) err += (p.contribution - (a * Math.exp(-(p.pick - 1) / k) + c)) ** 2;
    if (!best || err < best.err) best = { a, k, c, err };
  }
  return best ? { a: round4(best.a), k: best.k, c: round4(best.c) } : null;
}

export interface PlayerTrade { playerId: PlayerId; toUserId: UserId; week: number; created: number }

export interface DraftValueInput {
  /** season points under league scoring for every NFL player with stats */
  seasonPoints: Record<PlayerId, number>;
  players: PlayerDirectory;
  /** scored weeks in which the player had gp >= 1 */
  gamesPlayed: Record<PlayerId, number>;
  /** scored weeks in which at least 25 players on the NFL team had gp >= 1 (team from the current directory) */
  teamGames: Record<string, number>;
  lastScoredWeek: number;
  /** scale points for teams that have had their bye; only meaningful while the season is in progress */
  byeAdjust: boolean;
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
 * In season (byeAdjust) points are bye-adjusted first: a player's points are scaled by (most games any team has played) /
 * (games the player's team has played), so a team that has already had its bye is not behind. Missed
 * games while the team played still count as zero.
 *
 * Points over baseline: per valued position (BASELINE_RANKS keys), the pool is every directory
 * player at that position with adjusted points > 0, sorted desc; the baseline is the pool entry at
 * BASELINE_RANKS[pos] (0 if the pool is shorter). The bench gap is baseline minus the pool entry at
 * BENCH_RANKS[pos] (0 if shorter); weighted contribution is floored at minus the weighted gap. Redraft position ranks all valued-position
 * players with points > 0 by weighted PoB desc (POSITION_WEIGHTS; ties: points desc, id asc); zero
 * scorers tie at N + 1. Contribution (weighted PoB floored at minus the weighted bench gap) is fitted against pick
 * number to give the season's expected curve; each pick's earned pick is that curve run backwards at its
 * contribution, and value is earnedCapital(earnedPick) minus capital(pickNo): capital at the earned pick, bounded at
 * 100 + TOP_BONUS for earned picks before 1, 0 when off the board.
 * If the curve cannot be fitted the earned pick falls back to the redraft position. K, DEF and unknown positions
 * get null for every value field. Before the first scored week every value field is null.
 */
export function computeDraftValues(picks: DraftPick[], input: DraftValueInput): { picks: DraftPick[]; expectedCurve: ExpectedCurve | null; baselines: Record<string, PositionBaseline> } {
  const posOf = (id: PlayerId) => input.players[id]?.position ?? null;
  const valued = (pos: string | null): pos is string => pos !== null && BASELINE_RANKS[pos] !== undefined;
  const rawPts = (id: PlayerId) => input.seasonPoints[id] ?? 0;
  const maxTeamGames = Math.max(0, ...Object.values(input.teamGames));
  const byeFactor = (id: PlayerId): number => {
    const team = input.players[id]?.team ?? null;
    const games = team ? input.teamGames[team] ?? 0 : 0;
    return input.byeAdjust && games > 0 && maxTeamGames > games ? maxTeamGames / games : 1;
  };
  const pts = (id: PlayerId) => rawPts(id) * byeFactor(id);
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
  const benchGap = new Map<string, number>();
  const baselines: Record<string, PositionBaseline> = {};
  for (const [pos, all] of byPos) {
    const scorers = all.filter((id) => pts(id) > 0).sort((a, b) => pts(b) - pts(a) || (a < b ? -1 : a > b ? 1 : 0));
    const baseId = scorers[BASELINE_RANKS[pos] - 1];
    const benchRank = BENCH_RANKS[pos] ?? BASELINE_RANKS[pos];
    const benchId = scorers[benchRank - 1];
    const base = baseId ? pts(baseId) : 0;
    const bench = benchId ? pts(benchId) : 0;
    baselinePoints.set(pos, base);
    benchGap.set(pos, Math.max(base - bench, 0));
    if (scored) baselines[pos] = { baselineRank: BASELINE_RANKS[pos], baselinePoints: round2(base), benchRank, benchPoints: round2(bench) };
  }
  const pobOf = (id: PlayerId): number => round2(pts(id) - (baselinePoints.get(posOf(id) ?? '') ?? 0));
  const weightOf = (pos: string | null): number => (pos ? POSITION_WEIGHTS[pos] ?? 1 : 1);
  const weightedPob = (id: PlayerId): number => pobOf(id) * weightOf(posOf(id));

  // Redraft order across positions.
  const redraft = new Map<PlayerId, number>();
  const scorers = [...byPos.values()].flat().filter((id) => pts(id) > 0)
    .sort((a, b) => weightedPob(b) - weightedPob(a) || pts(b) - pts(a) || (a < b ? -1 : a > b ? 1 : 0));
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
    const seasonPoints = round2(rawPts(p.playerId));
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
      contribution: null as number | null,
      earnedPick: null as number | null,
      value: null as number | null,
    };
    if (!valued(pos)) return { ...common, posDraftRank: null };
    const posDraftRank = (seen.get(pos) ?? 0) + 1;
    seen.set(pos, posDraftRank);
    if (!scored) return { ...common, posDraftRank };
    const pob = pobOf(p.playerId);
    const w = weightOf(pos);
    return {
      ...common,
      posDraftRank,
      pointsOverBaseline: pob,
      redraftPos: redraft.get(p.playerId) ?? lastPos,
      contribution: round2(Math.max(pob * w, -(benchGap.get(pos) ?? 0) * w)),
    };
  });

  if (!scored) return { picks: base, expectedCurve: null, baselines };

  const curve = fitExpectedCurve(base.filter((p) => p.contribution !== null).map((p) => ({ pick: p.pickNo, contribution: p.contribution! })));
  const usable = curve !== null && curve.a > 0;
  const finished = base.map((p) => {
    if (p.contribution === null) return p;
    const earned = usable ? earnedPickFor(curve, p.contribution) : p.redraftPos;
    return { ...p, earnedPick: earned === null ? null : round1(earned), value: round1(earnedCapital(earned) - capital(p.pickNo)) };
  });
  return { picks: finished, expectedCurve: curve, baselines };
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
      pointsOverBaseline: null, redraftPos: null, contribution: null, earnedPick: null, value: null, tradedTo: null,
    }));
  const { picks, expectedCurve, baselines } = computeDraftValues(basePicks, value);

  let slotOrder: UserId[];
  if (draft.draft_order && Object.keys(draft.draft_order).length > 0) {
    slotOrder = Object.entries(draft.draft_order).sort((a, b) => a[1] - b[1]).map(([userId]) => userId);
  } else {
    slotOrder = picks.filter((p) => p.round === 1).sort((a, b) => a.slot - b.slot).map((p) => p.userId);
  }

  return { draftId: draft.draft_id, type: draft.type, rounds: draft.settings.rounds, slotOrder, picks, expectedCurve, baselines };
}
