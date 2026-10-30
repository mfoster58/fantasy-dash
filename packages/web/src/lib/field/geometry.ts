/**
 * Where a play is drawn on an upright field 160 units wide (53⅓ yards) and 360 deep: 3 units a yard, the end zone
 * the offense attacks on top (0-30), its own at the bottom. ESPN gives where a play started and ended and which
 * side and how deep a pass went, not the exact spot of a catch, so a catch is placed in its third of the field and a
 * run in its gap, with a little spread so plays on the same spot don't sit on top of each other.
 */
import type { FieldPlay } from './readPlays';

export const FIELD_W = 160;
export const FIELD_H = 360;
/** yards to the end zone to a y; a touchdown ends a little inside the end zone */
export const Y = (yte: number): number => 30 + Math.max(-6, Math.min(100, yte)) * 3;

const LANE = { left: 36, middle: 80, right: 124 } as const;
const GAP: Record<string, number> = {
  'left end': 34, 'left tackle': 60, 'left guard': 71, 'up the middle': 80, 'right guard': 89, 'right tackle': 100, 'right end': 126, scrambles: 80, kneels: 80,
};

/** a steady 0-1 from a play's id, so a play is placed the same way on every redraw */
function rand(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface Mark {
  /** the ball in the air: dashed */
  flight?: string;
  /** the run, or the run after the catch: solid */
  path?: string;
  /** where it ended, for the face and the points; null for a ball that fell incomplete */
  end: [number, number] | null;
  /** where an incomplete or intercepted ball came down */
  miss?: [number, number];
}

export function markOf(p: FieldPlay): Mark {
  const jx = (rand(p.id, 1) - 0.5) * 20;
  const endY = (gain: number) => (p.td ? Y(-4) : Y(p.los - gain));
  if (p.kind === 'run') {
    const gx = (GAP[p.gap ?? ''] ?? 80) + jx * 0.3, y0 = Y(p.los) + 10, ly = Y(p.los);
    const ex = r1(gx + (rand(p.id, 2) - 0.5) * Math.min(26, Math.abs(p.gain) * 1.2)), ey = endY(p.gain);
    return { path: `M80 ${r1(y0)} C${r1(gx)} ${r1(ly + 6)} ${r1(gx)} ${r1(ly - (ly - ey) * 0.45)} ${ex} ${ey}`, end: [ex, ey] };
  }
  const lane = LANE[p.dir] + jx * (p.dir === 'middle' ? 0.8 : 0.5);
  const x0 = r1(80 + jx * 0.2), y0 = Y(p.los) + 5;
  const deep = p.depth === 'deep';
  const missed = p.kind === 'inc' || p.kind === 'passinc' || p.kind === 'int';
  // the real air yards once nflverse has them; until then a deep catch is caught 1-5 yards short of where he went down
  // (deep catches average about 3 yards after), a short one 2-9 yards past the line with the rest after the catch
  const air = missed ? (deep ? 22 + rand(p.id, 3) * 12 : 6 + rand(p.id, 3) * 6)
    : p.air != null ? Math.min(p.air, p.gain)
      : deep ? p.gain - Math.min(p.gain, 1 + rand(p.id, 3) * 4) : Math.min(p.gain, Math.max(0, 2 + rand(p.id, 3) * 7));
  const cx = r1(lane), cy = Y(p.los - air);
  const arc = (x: number, y: number, bend: number) => `M${x0} ${y0} Q${r1((x0 + x) / 2 + (x > x0 ? -bend : bend))} ${r1((y0 + y) / 2)} ${x} ${y}`;
  if (missed) return { flight: arc(cx, cy, 8), end: p.kind === 'int' ? [cx, cy] : null, miss: [cx, cy] };
  const ex = r1(cx + (80 - cx) * 0.15 * rand(p.id, 4)), ey = endY(p.gain);
  // a quarterback's completion is one throw to where the play ended; the receiver's run after it isn't his
  if (p.kind === 'pass') return { path: arc(ex, ey, 10), end: [ex, ey] };
  return { flight: arc(cx, cy, 8), path: `M${cx} ${cy} L${ex} ${ey}`, end: [ex, ey] };
}

/** a play that gets the player's face and points on the whole week's field */
export function isBig(p: FieldPlay): boolean {
  if (p.td || p.kind === 'int') return true;
  if (p.kind === 'pass' || p.kind === 'passinc' || p.kind === 'inc') return false;
  return p.gain >= 25 || p.pts >= 4;
}
