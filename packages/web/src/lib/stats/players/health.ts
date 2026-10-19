import type { ChartDb, PlayerDb, PlayerId, PlayerWeek } from '@fantasy-dash/core';

export type GameState = 'healthy' | 'short' | 'missed' | 'bye';
type Injuries = ChartDb['injuries'] | undefined;
const OUT = new Set(['Out', 'Doubtful']);

const median = (v: number[]): number | null => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const shareOf = (r: PlayerWeek): number | null => (r.snaps != null && r.teamSnaps ? r.snaps / r.teamSnaps : null);

/** The highest week on the injury report; 0 when there is none. */
export function latestReportWeek(injuries: Injuries): number {
  let w = 0;
  for (const p of Object.values(injuries ?? {})) for (const k of Object.keys(p)) w = Math.max(w, Number(k));
  return w;
}

/** His Out or Doubtful status on the latest report, or null. */
export function currentInjury(gsis: string | null, injuries: Injuries): { status: string; injury: string } | null {
  const e = gsis ? injuries?.[gsis]?.[String(latestReportWeek(injuries))] : undefined;
  return e && OUT.has(e[0]) ? { status: e[0], injury: e[1] } : null;
}

/**
 * Each scored week for every player: healthy, short (injury-shortened), missed or bye.
 * Short: under half his usual snap share (the median of his other games) and on the report that week or the next;
 * or, in the latest scored week before a later report exists, under a third of his usual.
 */
export function gameStates(db: PlayerDb, injuries: Injuries): Map<PlayerId, Map<number, GameState>> {
  const played = new Set(db.teamWeeks.map((t) => `${t.team}|${t.week}`));
  const rows = new Map<PlayerId, Map<number, PlayerWeek>>();
  for (const r of db.rows) { let m = rows.get(r.id); if (!m) rows.set(r.id, (m = new Map())); m.set(r.week, r); }
  const latest = latestReportWeek(injuries);
  const out = new Map<PlayerId, Map<number, GameState>>();
  for (const [id, byWeek] of rows) {
    const p = db.players[id];
    const rep = (p?.gsisId ? injuries?.[p.gsisId] : undefined) ?? {};
    const shares = new Map<number, number>();
    for (const [w, r] of byWeek) { const s = r.gp ? shareOf(r) : null; if (s != null) shares.set(w, s); }
    const states = new Map<number, GameState>();
    let team = p?.teams[0] ?? '';
    for (let w = 1; w <= db.throughWeek; w++) {
      const r = byWeek.get(w);
      if (r) team = r.team;
      if (!r || !r.gp) { states.set(w, played.has(`${team}|${w}`) ? 'missed' : 'bye'); continue; }
      const share = shares.get(w), usual = median([...shares].filter(([k]) => k !== w).map(([, v]) => v));
      let short = false;
      if (share != null && usual != null && usual > 0) {
        const listed = rep[String(w)] !== undefined || rep[String(w + 1)] !== undefined;
        short = (share < usual / 2 && listed) || (w === db.throughWeek && latest <= w && share < usual / 3);
      }
      states.set(w, short ? 'short' : 'healthy');
    }
    out.set(id, states);
  }
  return out;
}
