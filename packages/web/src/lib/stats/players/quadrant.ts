/** Least-squares y = a + b·x; null when x has no spread. */
export function fitLine(xs: number[], ys: number[]): { a: number; b: number } | null {
  const n = xs.length; if (n < 2) return null;
  const sx = xs.reduce((s, v) => s + v, 0), sy = ys.reduce((s, v) => s + v, 0);
  const sxx = xs.reduce((s, v) => s + v * v, 0), sxy = xs.reduce((s, v, i) => s + v * ys[i], 0);
  const d = n * sxx - sx * sx; if (Math.abs(d) < 1e-12) return null;
  const b = (n * sxy - sx * sy) / d;
  return { a: (sy - b * sx) / n, b };
}

/** min and max padded by a share of the range (or of the value when there is no range). */
export function extent(vals: number[], pad = 0.08): [number, number] {
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || Math.abs(hi) * 0.2 || 1;
  return [+(lo - span * pad).toFixed(6), +(hi + span * pad).toFixed(6)];
}

/** "Jahmyr Gibbs" → "J. Gibbs"; one-word names stay whole. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : name;
}

/**
 * Labels to the right of their point. Each tries its own line, then one line below, one above, two below, two above,
 * and takes the first slot that clears the labels already placed and stays inside the bounds; a label with no slot is dropped
 * (its logo and tooltip remain). dy is how far it moved, for a leader line.
 */
export function placeLabels(items: { x: number; y: number; text: string }[], charW = 6.4, lineH = 12, bounds?: { top: number; bottom: number }): { x: number; y: number; text: string; dy: number }[] {
  const placed: { x: number; y: number; w: number; text: string; dy: number }[] = [];
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const w = it.text.length * charW;
    for (const dy of [0, lineH, -lineH, 2 * lineH, -2 * lineH]) {
      const y = it.y + dy;
      if (bounds && (y < bounds.top || y > bounds.bottom)) continue;
      if (placed.some((o) => Math.abs(o.y - y) < lineH && it.x < o.x + o.w && o.x < it.x + w)) continue;
      placed.push({ x: it.x, y, w, text: it.text, dy });
      break;
    }
  }
  return placed.map(({ x, y, text, dy }) => ({ x, y, text, dy }));
}
