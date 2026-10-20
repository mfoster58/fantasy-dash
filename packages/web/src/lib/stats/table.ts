import type { Season, UserId } from '@fantasy-dash/core';
import { teamGamesOf, type TeamGame } from '../managerGames';
import { fmtSigned, fmtWinPct } from '../format';
import { byWeek, managerRefs, regular, scopeSeasons } from './scope';
import { consistency, scheduleLuck, strengthOfSchedule } from './strength';
import { weeklyFinishes } from './season';
import { pointOrigins, wireActivity } from './roster';

export interface StatRow {
  id: UserId; seasons: number;
  w: number; l: number; t: number; apW: number; apL: number; apT: number; xw: number; luck: number; medW: number; medL: number; streakW: number; streakL: number;
  /** standings rank: record, then points for */
  rank: number;
  pf: number; pa: number; ppg: number; paPg: number; highs: number; top3: number; bottom3: number; sd: number; min: number; max: number;
  closeW: number; closeL: number; blowW: number; blowL: number; sos: number; postW: number; postL: number; postGames: number; postPpg: number;
  eff: number; benchLeft: number; projPlus: number; dProj: number;
  faab: number; pickups: number; waiverShare: number; draftValue: number;
  /** winners-bracket games only (quarterfinal, semifinal, final) */
  titles: number; runnerUps: number; thirds: number; poApps: number; poW: number; poL: number; poGames: number; poPpg: number; finals: number;
}
export type ColumnGroup = 'Season' | 'Record' | 'Scoring' | 'Games' | 'Lineups' | 'Roster' | 'Playoffs';
export interface ColumnDef { key: string; label: string; group: ColumnGroup; title: string; higherBetter: boolean; value: (r: StatRow) => number; text: (r: StatRow) => string }

export const CLOSE_MARGIN = 10;
export const BLOWOUT_MARGIN = 30;

const round2 = (n: number) => Math.round(n * 100) / 100;
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const chrono = (x: TeamGame, y: TeamGame) => x.year - y.year || x.week - y.week;
const rec = (w: number, l: number, t: number) => (t ? `${w}-${l}-${t}` : `${w}-${l}`);
const share = (w: number, l: number, t: number) => (w + l + t ? (w + t / 2) / (w + l + t) : 0);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const one = (v: number) => v.toFixed(1);

function blank(id: UserId): StatRow {
  return { id, seasons: 0, w: 0, l: 0, t: 0, apW: 0, apL: 0, apT: 0, xw: 0, luck: 0, medW: 0, medL: 0, streakW: 0, streakL: 0, rank: 0, pf: 0, pa: 0, ppg: 0, paPg: 0, highs: 0, top3: 0, bottom3: 0, sd: 0, min: 0, max: 0, closeW: 0, closeL: 0, blowW: 0, blowL: 0, sos: 0, postW: 0, postL: 0, postGames: 0, postPpg: 0, eff: 0, benchLeft: 0, projPlus: 0, dProj: 0, faab: 0, pickups: 0, waiverShare: 0, draftValue: 0, titles: 0, runnerUps: 0, thirds: 0, poApps: 0, poW: 0, poL: 0, poGames: 0, poPpg: 0, finals: 0 };
}

/** every advanced number per manager over the seasons given */
export function statTable(seasons: Season[]): StatRow[] {
  const sorted = scopeSeasons(seasons, 'all');
  const refs = managerRefs(sorted);
  const games = teamGamesOf(sorted);
  const reg = regular(games);
  const luck = new Map(scheduleLuck(reg).map((r) => [r.id, r]));
  const sos = new Map(strengthOfSchedule(reg).map((r) => [r.id, r]));
  const spread = new Map(consistency(reg).map((r) => [r.id, r]));
  const finishes = new Map(weeklyFinishes(sorted).map((r) => [r.id, r]));
  const origins = new Map(pointOrigins(sorted).map((r) => [r.id, r]));
  const highs = new Map<UserId, number>();
  for (const w of byWeek(reg)) { const top = Math.max(...w.games.map((g) => g.points)); for (const g of w.games) if (g.points === top) highs.set(g.userId, (highs.get(g.userId) ?? 0) + 1); }
  const rows = refs.map((ref) => {
    const r = blank(ref.id);
    const mine = games.filter((g) => g.userId === ref.id).sort(chrono);
    const myReg = mine.filter((g) => !g.isPlayoff);
    const myPost = mine.filter((g) => g.isPlayoff);
    for (const s of sorted) {
      const st = s.standings.find((x) => x.userId === ref.id);
      if (!st) continue;
      r.seasons += 1;
      if (s.honors.champion === ref.id) r.titles += 1;
      if (s.honors.runnerUp === ref.id) r.runnerUps += 1;
      if (s.honors.third === ref.id) r.thirds += 1;
      r.apW += st.allPlay.w; r.apL += st.allPlay.l; r.apT += st.allPlay.t;
      for (const p of s.draft?.picks ?? []) if (p.userId === ref.id && p.value !== null) r.draftValue += p.value;
      const wire = wireActivity(s).rows.find((x) => x.id === ref.id);
      if (wire) { r.faab += wire.faab; r.pickups += wire.total; }
    }
    for (const g of myReg) { if (g.result === 'W') r.w += 1; else if (g.result === 'L') r.l += 1; else r.t += 1; }
    const l = luck.get(ref.id);
    if (l) { r.medW = l.medianW; r.medL = l.medianL; }
    const played = r.w + r.l + r.t;
    r.xw = share(r.apW, r.apL, r.apT) * played;
    r.luck = r.w - r.xw;
    let runW = 0, runL = 0;
    for (const g of myReg) {
      runW = g.result === 'W' ? runW + 1 : 0; runL = g.result === 'L' ? runL + 1 : 0;
      r.streakW = Math.max(r.streakW, runW); r.streakL = Math.max(r.streakL, runL);
      const m = Math.abs(g.points - g.oppPoints);
      if (g.result !== 'T' && m <= CLOSE_MARGIN) { if (g.result === 'W') r.closeW += 1; else r.closeL += 1; }
      if (g.result !== 'T' && m >= BLOWOUT_MARGIN) { if (g.result === 'W') r.blowW += 1; else r.blowL += 1; }
    }
    const pts = myReg.map((g) => g.points);
    r.ppg = mean(pts);
    r.pf = round2(pts.reduce((a, b) => a + b, 0));
    r.pa = round2(myReg.reduce((a, g) => a + g.oppPoints, 0));
    r.paPg = mean(myReg.map((g) => g.oppPoints));
    r.highs = highs.get(ref.id) ?? 0;
    const f = finishes.get(ref.id);
    if (f) { r.top3 = f.top; r.bottom3 = f.bottom; }
    r.sd = pts.length ? Math.sqrt(mean(pts.map((p) => (p - r.ppg) ** 2))) : 0;
    const sp = spread.get(ref.id);
    if (sp) { r.min = sp.min; r.max = sp.max; }
    r.sos = sos.get(ref.id)?.delta ?? 0;
    for (const g of myPost) { if (g.result === 'W') r.postW += 1; else if (g.result === 'L') r.postL += 1; }
    r.postGames = myPost.length;
    r.postPpg = mean(myPost.map((g) => g.points));
    const ceiling = mine.reduce((t, g) => t + g.ceiling, 0);
    r.eff = ceiling ? mine.reduce((t, g) => t + g.points, 0) / ceiling : 0;
    r.benchLeft = round2(mine.reduce((t, g) => t + g.benchPoints, 0));
    r.projPlus = myReg.length ? myReg.filter((g) => g.points > g.projected).length / myReg.length : 0;
    r.dProj = round2(mean(myReg.map((g) => g.points - g.projected)));
    // the playoffs proper: winners-bracket games, never consolation
    const po = mine.filter((g) => g.postseason);
    r.poApps = new Set(po.map((g) => g.year)).size;
    r.poGames = po.length;
    for (const g of po) { if (g.result === 'W') r.poW += 1; else if (g.result === 'L') r.poL += 1; }
    r.poPpg = mean(po.map((g) => g.points));
    r.finals = po.filter((g) => g.tag === 'Final').length;
    const o = origins.get(ref.id);
    r.waiverShare = o && o.total ? o.pickup / o.total : 0;
    return r;
  });
  rankRows(rows);
  return rows;
}

const col = (key: string, label: string, group: ColumnGroup, title: string, higherBetter: boolean, value: (r: StatRow) => number, text: (r: StatRow) => string): ColumnDef => ({ key, label, group, title, higherBetter, value, text });

/** the standings rank, drawn left of the manager rather than in a group */
export const RANK_COLUMN: ColumnDef = col('rank', 'Rank', 'Season', 'Standings rank: record first, points for breaking ties', false, (r) => r.rank, (r) => String(r.rank));

/** 1 for the best record, points for breaking ties. */
export function rankRows(rows: StatRow[]): void {
  const pct = (r: StatRow) => share(r.w, r.l, r.t);
  [...rows].sort((x, y) => pct(y) - pct(x) || y.pf - x.pf || (x.id < y.id ? -1 : 1)).forEach((r, i) => { r.rank = i + 1; });
}

export const COLUMNS: ColumnDef[] = [
  col('seasons', 'Yrs', 'Season', 'Seasons played', true, (r) => r.seasons, (r) => String(r.seasons)),
  col('rec', 'Rec', 'Record', 'Regular-season record', true, (r) => share(r.w, r.l, r.t), (r) => rec(r.w, r.l, r.t)),
  col('allPlay', 'All-play', 'Record', 'Record against every other team every week', true, (r) => share(r.apW, r.apL, r.apT), (r) => rec(r.apW, r.apL, r.apT)),
  col('xw', 'xW', 'Record', 'Expected wins: all-play win rate × games played', true, (r) => r.xw, (r) => one(r.xw)),
  col('luck', 'Luck', 'Record', 'Wins minus expected wins', true, (r) => r.luck, (r) => fmtSigned(r.luck, 1)),
  col('median', 'vs med', 'Record', 'Record against the weekly league median', true, (r) => share(r.medW, r.medL, 0), (r) => rec(r.medW, r.medL, 0)),
  col('streaks', 'Streaks', 'Record', 'Longest win and loss streaks', true, (r) => r.streakW - r.streakL, (r) => `W${r.streakW} / L${r.streakL}`),
  col('pf', 'PF', 'Scoring', 'Points for, regular season', true, (r) => r.pf, (r) => one(r.pf)),
  col('pa', 'PA', 'Scoring', 'Points against, regular season', false, (r) => r.pa, (r) => one(r.pa)),
  col('ppg', 'PPG', 'Scoring', 'Points per game', true, (r) => r.ppg, (r) => one(r.ppg)),
  col('paPg', 'PA/G', 'Scoring', 'Points against per game', false, (r) => r.paPg, (r) => one(r.paPg)),
  col('highs', 'Highs', 'Scoring', 'Weeks as the top scorer', true, (r) => r.highs, (r) => String(r.highs)),
  col('top3', 'Top-3', 'Scoring', 'Weeks in the top three scorers', true, (r) => r.top3, (r) => String(r.top3)),
  col('bottom3', 'Bot-3', 'Scoring', 'Weeks in the bottom three scorers', false, (r) => r.bottom3, (r) => String(r.bottom3)),
  col('sd', 'SD', 'Scoring', 'Week-to-week spread (standard deviation)', false, (r) => r.sd, (r) => one(r.sd)),
  col('min', 'Min', 'Scoring', 'Lowest weekly score', true, (r) => r.min, (r) => one(r.min)),
  col('max', 'Max', 'Scoring', 'Highest weekly score', true, (r) => r.max, (r) => one(r.max)),
  col('close', 'Close', 'Games', `Record in games decided by ${CLOSE_MARGIN} or fewer`, true, (r) => share(r.closeW, r.closeL, 0), (r) => rec(r.closeW, r.closeL, 0)),
  col('sos', 'SOS', 'Games', "Opponents' average score against the league average", false, (r) => r.sos, (r) => fmtSigned(r.sos, 1)),
  col('post', 'Post rec', 'Games', 'Postseason record, consolation included', true, (r) => share(r.postW, r.postL, 0), (r) => rec(r.postW, r.postL, 0)),
  col('postPpg', 'Post PPG', 'Games', 'Postseason points per game', true, (r) => r.postPpg, (r) => (r.postGames ? one(r.postPpg) : '—')),
  col('eff', 'Eff', 'Lineups', 'Points scored as a share of the best possible lineup', true, (r) => r.eff, (r) => pct(r.eff)),
  col('bench', 'Bench+', 'Lineups', 'Points the best lineup would have added', false, (r) => r.benchLeft, (r) => r.benchLeft.toFixed(0)),
  col('projPlus', 'Proj+', 'Lineups', "Share of weeks over Sleeper's projection", true, (r) => r.projPlus, (r) => pct(r.projPlus)),
  col('dProj', 'Δproj', 'Lineups', 'Average points over projection', true, (r) => r.dProj, (r) => fmtSigned(r.dProj, 1)),
  col('pickups', 'Pickups', 'Roster', 'Waiver and free-agent adds', true, (r) => r.pickups, (r) => String(r.pickups)),
  col('waiverShare', 'Wire pts', 'Roster', 'Share of started points from pickups', true, (r) => r.waiverShare, (r) => pct(r.waiverShare)),
  col('draftValue', 'Draft', 'Roster', 'Sum of pick values from the draft grading', true, (r) => r.draftValue, (r) => fmtSigned(r.draftValue, 0)),
  col('poApps', 'Apps', 'Playoffs', 'Seasons in the winners bracket', true, (r) => r.poApps, (r) => String(r.poApps)),
  col('poRec', 'Rec', 'Playoffs', 'Record in winners-bracket games', true, (r) => share(r.poW, r.poL, 0), (r) => rec(r.poW, r.poL, 0)),
  col('poPct', 'Win %', 'Playoffs', 'Win share in winners-bracket games', true, (r) => share(r.poW, r.poL, 0), (r) => (r.poGames ? fmtWinPct(share(r.poW, r.poL, 0)) : '—')),
  col('poPpg', 'PPG', 'Playoffs', 'Points per winners-bracket game', true, (r) => r.poPpg, (r) => (r.poGames ? one(r.poPpg) : '—')),
  col('finals', 'Finals', 'Playoffs', 'Championship games played', true, (r) => r.finals, (r) => String(r.finals)),
  col('titles', 'Titles', 'Playoffs', 'Championships won', true, (r) => r.titles, (r) => String(r.titles)),
];
