/**
 * Fit POSITION_WEIGHTS to this league's own draft market.
 *
 * For each completed season, the league's price for the Nth player taken at a position is the capital of the pick he
 * went at. The model's price for the Nth-best finisher at that position (by season points among drafted players) is
 * the capital of his earned pick. The top K finishers at every position beat their league slots on average, because
 * the finishers are the realised winners while the curve is fitted through every pick, busts included; that shared
 * bias is not the model being wrong about a position. What the fit removes is the DIFFERENCE between positions: one
 * weight per position (receivers fixed at 1 as the reference) so that the mean of (capital earned − capital of the
 * league slot) over the top K finishers, pooled over the seasons given, is the same for every position. Capital is
 * the space the grades sum in, and it is bounded (TOP_BONUS before pick 1, 0 off the board), so no clipping is
 * needed. Weights interact through the shared expected curve, so the search is coordinate descent over a grid; the
 * result is normalised so the largest weight is 1 (earned picks are invariant to a common scale of contributions,
 * bench floor included).
 *
 * K decides which end of a position's market the weight matches, and a single multiplier cannot fit a market that is
 * convex at a position (TE1 is priced about right while TE4-6 are still over-credited), so K is a real tuning choice:
 * the script prints the fit for the default K and for two alternatives so the sensitivity is visible.
 *
 *   pnpm tsx scripts/fit-position-weights.ts            # 2023 2024 2025
 *   pnpm tsx scripts/fit-position-weights.ts 2023 2024  # chosen seasons
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASELINE_RANKS, POSITION_WEIGHTS, capital, earnedCapital, earnedPickFor, fitExpectedCurve, type PlayerDirectory, type Season } from '@fantasy-dash/core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const years = process.argv.slice(2).map(Number).filter((y) => y > 0);
const YEARS = years.length ? years : [2023, 2024, 2025];
const POSITIONS = ['QB', 'RB', 'WR', 'TE'];
const REFERENCE = 'WR';
/** how many finishers per position the fit compares; the default is roughly what the league starts */
const TOP_K: Record<string, number> = { QB: 6, RB: 12, WR: 12, TE: 6 };
const ALT_K: Record<string, Record<string, number>> = {
  'top 3 / 6': { QB: 3, RB: 6, WR: 6, TE: 3 },
  'baseline ranks': { ...BASELINE_RANKS },
};
const GRID = Array.from({ length: 30 }, (_, i) => Math.round((0.05 + i * 0.05) * 100) / 100); // 0.05 .. 1.5

const players = JSON.parse(readFileSync(path.join(ROOT, 'data', 'players.json'), 'utf8')) as PlayerDirectory;
const seasons = YEARS.map((y) => JSON.parse(readFileSync(path.join(ROOT, 'data', 'leagues', 'husky', 'seasons', `${y}.json`), 'utf8')) as Season);

interface Row { pick: number; pos: string; pts: number; pob: number; benchGap: number }
const rowsBySeason = seasons.map((s) => {
  if (!s.draft) throw new Error(`${s.year}: no draft`);
  const b = s.draft.baselines;
  return s.draft.picks.flatMap((p): Row[] => {
    const pos = players[p.playerId]?.position ?? null;
    if (pos === null || BASELINE_RANKS[pos] === undefined || p.pointsOverBaseline === null) return [];
    const gap = b[pos] ? b[pos].baselinePoints - b[pos].benchPoints : 0;
    return [{ pick: p.pickNo, pos, pts: p.seasonPoints, pob: p.pointsOverBaseline, benchGap: gap }];
  });
});

/** Each season's rows with their contribution under the weights, and that season's refitted curve. */
function contributionsFor(rows: Row[], weights: Record<string, number>) {
  const w = (pos: string) => weights[pos] ?? 1;
  const contrib = rows.map((r) => ({ ...r, contribution: Math.max(r.pob * w(r.pos), -r.benchGap * w(r.pos)) }));
  const curve = fitExpectedCurve(contrib.map((r) => ({ pick: r.pick, contribution: r.contribution })));
  if (!curve || curve.a <= 0) throw new Error('degenerate curve');
  return { contrib, curve };
}

/** Per position: capital earned − capital of the league slot, for the top K finishers, pooled over seasons. Also counts off-board finishers. */
function errors(weights: Record<string, number>, topK: Record<string, number>): { errs: Record<string, number[]>; offBoard: number } {
  const errs: Record<string, number[]> = {};
  let offBoard = 0;
  for (const rows of rowsBySeason) {
    const { contrib, curve } = contributionsFor(rows, weights);
    for (const pos of POSITIONS) {
      const atPos = contrib.filter((r) => r.pos === pos);
      const slots = atPos.map((r) => r.pick).sort((a, b) => a - b);
      const finishers = [...atPos].sort((a, b) => b.pts - a.pts);
      for (let i = 0; i < Math.min(topK[pos], slots.length, finishers.length); i++) {
        const earned = earnedPickFor(curve, finishers[i].contribution);
        if (earned === null) offBoard++;
        (errs[pos] ??= []).push(earnedCapital(earned) - capital(slots[i]));
      }
    }
  }
  return { errs, offBoard };
}
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
/** Spread of the per-position mean bias around the cross-position mean: 0 when every position is credited alike. */
function spread(errs: Record<string, number[]>): number {
  const means = Object.values(errs).map(mean);
  const centre = mean(means);
  return means.reduce((s, m) => s + (m - centre) ** 2, 0);
}

/** League picks in the first 36 vs model top 36 by earned pick, by position, summed over the seasons. */
function composition(weights: Record<string, number>): { league: Record<string, number>; model: Record<string, number> } {
  const league: Record<string, number> = {};
  const model: Record<string, number> = {};
  for (const rows of rowsBySeason) {
    const { contrib, curve } = contributionsFor(rows, weights);
    for (const r of rows.filter((r) => r.pick <= 36)) league[r.pos] = (league[r.pos] ?? 0) + 1;
    const top = contrib.map((r) => ({ pos: r.pos, earned: earnedPickFor(curve, r.contribution) ?? Infinity })).sort((a, b) => a.earned - b.earned).slice(0, 36);
    for (const r of top) model[r.pos] = (model[r.pos] ?? 0) + 1;
  }
  return { league, model };
}

function fit(topK: Record<string, number>): Record<string, number> {
  let weights: Record<string, number> = Object.fromEntries(POSITIONS.map((pos) => [pos, 1]));
  for (let round = 0; round < 4; round++) {
    for (const pos of POSITIONS.filter((p) => p !== REFERENCE)) {
      let best = { w: weights[pos], err: spread(errors(weights, topK).errs) };
      for (const w of GRID) {
        const err = spread(errors({ ...weights, [pos]: w }, topK).errs);
        if (err < best.err - 1e-9) best = { w, err };
      }
      weights[pos] = best.w;
    }
  }
  const top = Math.max(...Object.values(weights));
  if (top > 1) console.log(`  note: ${REFERENCE} is no longer the reference; weights were normalised by ${top}`);
  weights = Object.fromEntries(Object.entries(weights).map(([pos, w]) => [pos, Math.round((w / top) * 20) / 20]));
  return weights;
}

const report = (label: string, ws: Record<string, number>, topK: Record<string, number>) => {
  const { errs, offBoard } = errors(ws, topK);
  console.log(`\n${label}: ${JSON.stringify(ws)}`);
  for (const pos of POSITIONS) {
    const onBound = ws[pos] <= GRID[0] || ws[pos] >= GRID[GRID.length - 1];
    console.log(`  ${pos}: mean capital earned − slot ${mean(errs[pos]).toFixed(1).padStart(6)}  rms ${Math.sqrt(mean(errs[pos].map((e) => e * e))).toFixed(1).padStart(5)}  (top ${topK[pos]}, ${errs[pos].length} rows)${onBound ? '  ** ON GRID BOUNDARY: not a fitted optimum **' : ''}`);
  }
  console.log(`  spread of position bias ${spread(errs).toFixed(1)}; off-board finishers ${offBoard}`);
  const { league, model } = composition(ws);
  console.log(`  first 36 picks by position, league ${JSON.stringify(league)} vs model top 36 by earned pick ${JSON.stringify(model)}`);
};

console.log(`seasons: ${YEARS.join(', ')}; K = ${JSON.stringify(TOP_K)}`);
const current = { ...Object.fromEntries(POSITIONS.map((p) => [p, 1])), ...POSITION_WEIGHTS };
report('current POSITION_WEIGHTS', current, TOP_K);
const fitted = fit(TOP_K);
report('fitted', fitted, TOP_K);
for (const [label, k] of Object.entries(ALT_K)) console.log(`  sensitivity, K = ${label} ${JSON.stringify(k)}: ${JSON.stringify(fit(k))}`);
const drift = POSITIONS.filter((pos) => (fitted[pos] ?? 1) !== (current[pos] ?? 1));
if (drift.length) {
  console.log(`\nDRIFT: fitted weights differ from POSITION_WEIGHTS at ${drift.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('\nPOSITION_WEIGHTS match the fit.');
}
