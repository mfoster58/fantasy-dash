import type { PlayerLine } from './playerLines';

export const XFP_POSITIONS: readonly string[] = ['QB', 'RB', 'WR', 'TE'];
export const MIN_FIT_LINES = 20;

/** Expected fantasy points from volume: points = a + b1·targets + b2·carries + b3·passAttempts, one fit per position. */
export interface XfpModel {
  /** [a, b1, b2, b3] per position; null when that position has no model */
  coef: Record<string, number[] | null>;
  predict(line: PlayerLine): number | null;
}

const features = (l: PlayerLine) => [1, l.targets, l.carries, l.passAttempts];

/** Solve A·x = b by Gaussian elimination with partial pivoting; null when singular. */
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    if (Math.abs(M[pivot][col]) < 1e-9) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Ordinary least squares on the active columns (those with any variance); dropped columns get coefficient 0. */
function fitPosition(rows: PlayerLine[]): number[] | null {
  if (rows.length < MIN_FIT_LINES) return null;
  const X = rows.map(features);
  const y = rows.map((l) => l.points);
  const k = X[0].length;
  const active = [0, ...[1, 2, 3].filter((j) => X.some((row) => row[j] !== X[0][j]))];
  const m = active.length;
  const XtX = Array.from({ length: m }, () => Array(m).fill(0) as number[]);
  const Xty = Array(m).fill(0) as number[];
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < m; a++) {
      Xty[a] += X[i][active[a]] * y[i];
      for (let b = 0; b < m; b++) XtX[a][b] += X[i][active[a]] * X[i][active[b]];
    }
  }
  const beta = solve(XtX, Xty);
  if (!beta) return null;
  const full = Array(k).fill(0) as number[];
  active.forEach((j, idx) => { full[j] = beta[idx]; });
  return full;
}

export function fitXfp(lines: PlayerLine[]): XfpModel {
  const coef: Record<string, number[] | null> = {};
  for (const pos of XFP_POSITIONS) {
    coef[pos] = fitPosition(lines.filter((l) => l.played && l.position === pos));
  }
  return {
    coef,
    predict(line) {
      const c = coef[line.position];
      if (!c) return null;
      const f = features(line);
      return Math.round(c.reduce((s, b, j) => s + b * f[j], 0) * 100) / 100;
    },
  };
}
