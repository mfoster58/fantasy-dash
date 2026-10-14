import { computeStreak, isRegularSeason, type Result } from './standings';
import { round2, round4 } from './scoring';
import { h2hKey, type AllTimeRow, type H2HSeries, type History, type Season, type UserId } from './types';

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

interface AllTimeAcc {
  seasons: Set<number>;
  w: number; l: number; t: number; pf: number; pa: number; max: number; games: number;
  ap: { w: number; l: number; t: number };
  highs: number;
  results: Result[];
  titles: number; runnerUps: number; thirds: number; playoffApps: number; playoffWins: number; toiletBowls: number;
}

export function buildAllTime(seasons: Season[]): AllTimeRow[] {
  const sorted = [...seasons].sort((a, b) => a.year - b.year);
  const acc = new Map<UserId, AllTimeAcc>();
  const get = (u: UserId): AllTimeAcc => {
    let a = acc.get(u);
    if (!a) {
      a = { seasons: new Set(), w: 0, l: 0, t: 0, pf: 0, pa: 0, max: 0, games: 0, ap: { w: 0, l: 0, t: 0 }, highs: 0, results: [],
        titles: 0, runnerUps: 0, thirds: 0, playoffApps: 0, playoffWins: 0, toiletBowls: 0 };
      acc.set(u, a);
    }
    return a;
  };

  for (const s of sorted) {
    for (const m of Object.values(s.managers)) get(m.userId).seasons.add(s.year);

    for (const row of s.standings) {
      const a = get(row.userId);
      a.w += row.w; a.l += row.l; a.t += row.t;
      a.pf += row.pf; a.pa += row.pa; a.max += row.maxPoints;
      a.games += row.w + row.l + row.t;
      a.ap.w += row.allPlay.w; a.ap.l += row.allPlay.l; a.ap.t += row.allPlay.t;
      a.highs += row.weeklyHighs;
    }

    for (const wk of s.weeks) {
      if (!wk.played || !isRegularSeason(wk.week, s.playoffWeekStart)) continue;
      for (const g of wk.games) {
        g.sides.forEach((side, i) => {
          const opp = g.sides[1 - i];
          get(side.userId).results.push(side.points > opp.points ? 'W' : side.points < opp.points ? 'L' : 'T');
        });
      }
    }

    const seeded = new Set<UserId>();
    for (const bg of s.brackets.winners) {
      if (bg.home) seeded.add(bg.home);
      if (bg.away) seeded.add(bg.away);
      if (bg.advanced) get(bg.advanced).playoffWins += 1;
    }
    for (const u of seeded) get(u).playoffApps += 1;

    if (s.honors.champion) get(s.honors.champion).titles += 1;
    if (s.honors.runnerUp) get(s.honors.runnerUp).runnerUps += 1;
    if (s.honors.third) get(s.honors.third).thirds += 1;
    if (s.honors.lastPlace) get(s.honors.lastPlace).toiletBowls += 1;
  }

  const rows: AllTimeRow[] = [...acc.entries()].map(([userId, a]) => {
    const apTotal = a.ap.w + a.ap.l + a.ap.t;
    return {
      userId, rank: 0, seasons: a.seasons.size,
      w: a.w, l: a.l, t: a.t,
      winPct: a.games ? round4((a.w + a.t / 2) / a.games) : 0,
      pf: round2(a.pf), pa: round2(a.pa),
      ppg: a.games ? round2(a.pf / a.games) : 0,
      maxPoints: round2(a.max),
      efficiency: a.max ? round4(a.pf / a.max) : 0,
      streak: computeStreak(a.results),
      allPlay: { ...a.ap, pct: apTotal ? round4((a.ap.w + a.ap.t / 2) / apTotal) : 0 },
      weeklyHighs: a.highs,
      titles: a.titles, runnerUps: a.runnerUps, thirds: a.thirds,
      playoffApps: a.playoffApps, playoffWins: a.playoffWins, toiletBowls: a.toiletBowls,
    };
  });
  rows.sort((x, y) => y.w - x.w || y.pf - x.pf);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
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
      lastScoredWeek: s.lastScoredWeek, playoffWeekStart: s.playoffWeekStart, honors: s.honors,
    })),
    managers,
    h2h,
    allTime: buildAllTime(sorted),
  };
}
