import type { Season, UserId } from '@fantasy-dash/core';

/** one award winner, as his team was that season */
export interface Winner { userId: UserId; team: string; manager: string; avatar: string | null; w: number; l: number; t: number; rank: number | null; pf: number | null }

export interface SeasonHardware {
  year: number;
  /** still being played: only the top seed and points leader so far */
  live: boolean;
  lastScoredWeek: number;
  champion: Winner | null; runnerUp: Winner | null; third: Winner | null;
  /** the points title, or the points leader so far while live */
  pointsTitle: Winner | null;
  /** the regular season's top seed, or the leader so far while live */
  seed: Winner | null;
  lastPlace: Winner | null;
  /** the championship game's score, champion first */
  final: { winner: number; loser: number } | null;
}

/** a Sleeper avatar id at full size; an uploaded picture's URL as it is */
const fullAvatar = (a: string | null | undefined): string | null => (!a ? null : a.startsWith('https://') ? a : `https://sleepercdn.com/avatars/${a}`);

/** Who won what in a season, with the team name and picture each had that season. */
export function seasonHardware(s: Season): SeasonHardware {
  const live = s.status !== 'complete';
  const who = (id: UserId | null | undefined): Winner | null => {
    if (!id) return null;
    const m = s.managers[id];
    const r = s.standings.find((x) => x.userId === id);
    const manager = m?.displayName ?? id;
    return { userId: id, team: m?.teamName ?? manager, manager, avatar: fullAvatar(m?.avatar), w: r?.w ?? 0, l: r?.l ?? 0, t: r?.t ?? 0, rank: r?.rank ?? null, pf: r?.pf ?? null };
  };
  const seed = s.standings.find((x) => x.rank === 1)?.userId;
  const topPf = [...s.standings].sort((a, b) => b.pf - a.pf)[0]?.userId;
  let final: SeasonHardware['final'] = null;
  const champ = s.honors.champion;
  if (!live && champ) {
    for (const w of s.weeks) for (const g of w.games) {
      if (g.tag !== 'Final' || !w.played) continue;
      const c = g.sides.find((x) => x.userId === champ), o = g.sides.find((x) => x.userId !== champ);
      if (c && o) final = { winner: c.points, loser: o.points };
    }
  }
  return {
    year: s.year, live, lastScoredWeek: s.lastScoredWeek,
    champion: live ? null : who(champ), runnerUp: live ? null : who(s.honors.runnerUp), third: live ? null : who(s.honors.third),
    pointsTitle: who(live ? topPf : s.honors.pointsTitle), seed: who(seed), lastPlace: live ? null : who(s.honors.lastPlace),
    final,
  };
}
