import type { History, UserId } from '@fantasy-dash/core';

export interface Streak {
  userId: UserId;
  kind: 'W' | 'L';
  length: number;
  from: { year: number; week: number };
  to: { year: number; week: number };
  /** the run includes the manager's most recent game */
  active: boolean;
}

interface Result { year: number; week: number; r: 'W' | 'L' | 'T' }

/** Each manager's longest run of `kind` across every played game, playoffs included, carried across seasons. One streak per manager. */
export function longestStreaks(h2h: History['h2h'], kind: 'W' | 'L', limit = 5): Streak[] {
  const byUser = new Map<UserId, Result[]>();
  const push = (u: UserId, r: Result) => { const arr = byUser.get(u) ?? []; arr.push(r); byUser.set(u, arr); };
  for (const s of Object.values(h2h)) {
    for (const g of s.games) {
      const aRes: Result['r'] = g.aPoints > g.bPoints ? 'W' : g.aPoints < g.bPoints ? 'L' : 'T';
      const bRes: Result['r'] = aRes === 'W' ? 'L' : aRes === 'L' ? 'W' : 'T';
      push(s.a, { year: g.year, week: g.week, r: aRes });
      push(s.b, { year: g.year, week: g.week, r: bRes });
    }
  }

  const out: Streak[] = [];
  for (const [userId, results] of byUser) {
    results.sort((x, y) => x.year - y.year || x.week - y.week);
    let best: Streak | null = null;
    let run: Result[] = [];
    const flush = (endsAtLatest: boolean) => {
      if (run.length === 0) return;
      const candidate: Streak = {
        userId, kind, length: run.length,
        from: { year: run[0].year, week: run[0].week },
        to: { year: run[run.length - 1].year, week: run[run.length - 1].week },
        active: endsAtLatest,
      };
      if (!best || candidate.length >= best.length) best = candidate; // later run wins a tie: more recent
      run = [];
    };
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.r === kind) run.push(r);
      else flush(false);
      if (i === results.length - 1) flush(true);
    }
    if (best) out.push(best);
  }

  return out
    .sort((x, y) => y.length - x.length || y.to.year - x.to.year || y.to.week - x.to.week || (x.userId < y.userId ? -1 : 1))
    .slice(0, limit);
}
