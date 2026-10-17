/** Solve A·x = b by Gaussian elimination with partial pivoting; null when singular. */
export function solve(A: number[][], b: number[]): number[] | null {
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

/** Ordinary least squares. Column 0 is the intercept; columns with no variance are dropped and get coefficient 0. Null when singular or empty. */
export function fitOls(X: number[][], y: number[]): number[] | null {
  if (X.length === 0 || X.length !== y.length) return null;
  const k = X[0].length;
  const active = [0, ...Array.from({ length: k - 1 }, (_, j) => j + 1).filter((j) => X.some((row) => row[j] !== X[0][j]))];
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
