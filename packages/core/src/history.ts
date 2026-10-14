import { h2hKey, type H2HSeries, type History, type Season } from './types';

export function buildHistory(seasons: Season[]): History {
  const sorted = [...seasons].sort((a, b) => a.year - b.year);

  const managers: History['managers'] = {};
  for (const s of sorted) {
    for (const m of Object.values(s.managers)) {
      const entry = managers[m.userId] ?? { displayName: m.displayName, avatar: m.avatar, seasons: [] };
      entry.displayName = m.displayName;
      entry.avatar = m.avatar;
      entry.seasons.push(s.year);
      managers[m.userId] = entry;
    }
  }

  const h2h: Record<string, H2HSeries> = {};
  for (const s of sorted) {
    for (const wk of s.weeks) {
      if (!wk.played) continue;
      for (const g of wk.games) {
        const [x, y] = g.sides;
        const key = h2hKey(x.userId, y.userId);
        const [a, b] = key.split('|');
        const series = h2h[key] ?? { a, b, aWins: 0, bWins: 0, ties: 0, games: [] };
        const aSide = x.userId === a ? x : y;
        const bSide = aSide === x ? y : x;
        if (aSide.points > bSide.points) series.aWins += 1;
        else if (aSide.points < bSide.points) series.bWins += 1;
        else series.ties += 1;
        series.games.push({ gameId: g.id, year: s.year, week: g.week, tag: g.tag, aPoints: aSide.points, bPoints: bSide.points });
        h2h[key] = series;
      }
    }
  }
  for (const series of Object.values(h2h)) {
    series.games.sort((p, q) => q.year - p.year || q.week - p.week);
  }

  return {
    seasons: sorted.map((s) => ({
      year: s.year, leagueId: s.leagueId, status: s.status,
      lastScoredWeek: s.lastScoredWeek, playoffWeekStart: s.playoffWeekStart,
    })),
    managers,
    h2h,
  };
}
