import { round2 } from './scoring';
import { h2hKey, type H2HSeries, type History, type Season, type UserId } from './types';

/** Fill streak, totals, biggest win, closest game and average margin from `games` (newest first). */
export function summarizeSeries(series: H2HSeries): H2HSeries {
  const games = series.games;
  let holder: UserId | null = null;
  let length = 0;
  for (const g of games) {
    const winner = g.aPoints > g.bPoints ? series.a : g.bPoints > g.aPoints ? series.b : null;
    if (length === 0) {
      if (!winner) break;
      holder = winner;
      length = 1;
    } else if (winner === holder) {
      length += 1;
    } else {
      break;
    }
  }

  let totalA = 0;
  let totalB = 0;
  let biggestWin: H2HSeries['biggestWin'] = null;
  let closest: H2HSeries['closest'] = null;
  let marginSum = 0;
  for (const g of games) {
    totalA += g.aPoints;
    totalB += g.bPoints;
    const margin = round2(Math.abs(g.aPoints - g.bPoints));
    marginSum += margin;
    if (margin > 0 && (!biggestWin || margin > biggestWin.margin)) {
      biggestWin = { gameId: g.gameId, winner: g.aPoints > g.bPoints ? series.a : series.b, margin };
    }
    if (!closest || margin < closest.margin) closest = { gameId: g.gameId, margin };
  }

  return {
    ...series,
    streak: { holder, length },
    totalPoints: { a: round2(totalA), b: round2(totalB) },
    biggestWin,
    closest,
    avgMargin: games.length ? round2(marginSum / games.length) : 0,
  };
}

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
        const series: H2HSeries = h2h[key] ?? {
          a, b, aWins: 0, bWins: 0, ties: 0,
          streak: { holder: null, length: 0 }, totalPoints: { a: 0, b: 0 }, biggestWin: null, closest: null, avgMargin: 0,
          games: [],
        };
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
  for (const [key, series] of Object.entries(h2h)) {
    series.games.sort((p, q) => q.year - p.year || q.week - p.week);
    h2h[key] = summarizeSeries(series);
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
