import type { BracketGame, DraftPick, History, PlayerDirectory, PlayerId, PlayoffTag, Season, SeasonStatus, StandingRow, Transaction, UserId, Week, WLT } from '@fantasy-dash/core';
import { teamGamesOf, type TeamGame } from './managerGames';
import { letterGrade, managerDraftSummaries } from './draft';
import { flattenLines, type PlayerLine } from './playerLines';
import { waiverClaims } from './waivers';
import type { FinishKind } from '../components/Icons';

export const PROFILE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
export const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
/** 1 + the number of values strictly better than mine. */
const rankOf = (mine: number, all: number[], better: (a: number, b: number) => boolean) => 1 + all.filter((v) => better(v, mine)).length;
const involves = (t: Transaction, userId: UserId) => t.adds.some((m) => m.userId === userId) || t.drops.some((m) => m.userId === userId);

/**
 * Every team's final place in a complete season, read off the placement games: the Final decides 1st and 2nd, the
 * 3rd- and 5th-place games the next pairs, the Toilet Bowl last and second-last, the 7th-place game the pair above.
 * Anyone the brackets never placed fills the open places by seed. Empty while the season is in progress.
 */
export function finalPlacement(season: Season): Map<UserId, number> {
  const out = new Map<UserId, number>();
  if (season.status !== 'complete') return out;
  const n = season.standings.length;
  const place = (g: BracketGame, winner: number, loser: number) => {
    if (!g.advanced || !g.home || !g.away) return;
    out.set(g.advanced, winner);
    out.set(g.advanced === g.home ? g.away : g.home, loser);
  };
  for (const g of season.brackets.winners) if (g.placement !== null) place(g, g.placement, g.placement + 1);
  for (const g of season.brackets.consolation) if (g.placement !== null) place(g, n + 1 - g.placement, n - g.placement);
  const taken = new Set(out.values());
  const open = Array.from({ length: n }, (_, i) => i + 1).filter((p) => !taken.has(p));
  for (const r of [...season.standings].sort((a, b) => a.rank - b.rank)) if (!out.has(r.userId)) out.set(r.userId, open.shift() ?? r.rank);
  return out;
}

export interface Finish {
  /** null before the season ends */
  place: number | null;
  /** `1st` … `10th`, or `—` */
  label: string;
  /** trophy and medals for the podium, the toilet for the last-place loser */
  icon: FinishKind | null;
  note: string | null;
}

/** Where the manager finished once the playoffs are done; pass a precomputed placement when labelling every team. */
export function finishOf(season: Season, userId: UserId, placement = finalPlacement(season)): Finish {
  const place = placement.get(userId);
  if (place === undefined) return { place: null, label: '—', icon: null, note: null };
  const teams = season.standings.length;
  const [icon, note]: [FinishKind | null, string] = place === 1 ? ['champion', 'Champion'] : place === 2 ? ['runnerUp', 'Runner-up'] : place === 3 ? ['third', 'Third place']
    : place === teams ? ['toilet', 'Toilet bowl'] : [null, `of ${teams}`];
  return { place, label: ordinal(place), icon, note };
}

export interface WeekLine {
  week: number; tag: PlayoffTag | null; isPlayoff: boolean; matchupId: number;
  opponentId: UserId; points: number; oppPoints: number; result: 'W' | 'L' | 'T';
  /** mean score of every team that week */
  leagueAvg: number;
  high: boolean; low: boolean;
}

export type ScheduleEntry =
  | ({ kind: 'played' } & WeekLine)
  | { kind: 'upcoming'; week: number; tag: PlayoffTag | null; isPlayoff: boolean; matchupId: number; opponentId: UserId; projected: number; oppProjected: number }
  | { kind: 'bye'; week: number; leagueAvg: number };

export interface BestStart {
  playerId: PlayerId; week: number; matchupId: number; opponentId: UserId; tag: PlayoffTag | null; points: number;
  /** started inside a waiver or free-agent pickup window */
  waiver: boolean;
}

/** mean score of every team that week */
const leagueAvgOf = (wk: Week) => {
  const all = wk.games.flatMap((x) => x.sides.map((s) => s.points));
  return round1(all.reduce((t, p) => t + p, 0) / Math.max(1, all.length));
};

/**
 * The manager's highest-scoring single-week starts, and the best of them by players picked up off waivers or
 * free agency: a start counts as a pickup start from the add's week until the manager next drops the player.
 */
export function bestStarts(season: Season, userId: UserId, n = 5): { all: BestStart[]; waiver: BestStart[] } {
  const sorted = [...season.transactions].sort((a, b) => a.created - b.created || (a.id < b.id ? -1 : 1));
  const windows: { playerId: PlayerId; from: number; to: number }[] = [];
  for (const tx of sorted) {
    if (tx.type !== 'waiver' && tx.type !== 'free_agent') continue;
    for (const add of tx.adds) {
      if (add.userId !== userId) continue;
      const drop = sorted.find((o) => o.created > tx.created && o.drops.some((d) => d.playerId === add.playerId && d.userId === userId));
      windows.push({ playerId: add.playerId, from: tx.week, to: drop ? drop.week : Infinity });
    }
  }
  const starts: BestStart[] = [];
  for (const wk of season.weeks) {
    if (!wk.played) continue;
    for (const g of wk.games) {
      const me = g.sides.find((s) => s.userId === userId), opp = g.sides.find((s) => s.userId !== userId);
      if (!me || !opp) continue;
      for (const e of me.starters) {
        if (!e.player) continue;
        const id = e.player.playerId;
        starts.push({ playerId: id, week: wk.week, matchupId: g.matchupId, opponentId: opp.userId, tag: g.tag, points: e.player.points, waiver: windows.some((w) => w.playerId === id && wk.week >= w.from && wk.week <= w.to) });
      }
    }
  }
  starts.sort((a, b) => b.points - a.points || a.week - b.week || (a.playerId < b.playerId ? -1 : 1));
  return { all: starts.slice(0, n), waiver: starts.filter((s) => s.waiver).slice(0, n) };
}

export interface PositionPlayer {
  playerId: PlayerId; position: string;
  /** points while in the starting lineup */
  started: number; starts: number; high: number;
  /** points while on the bench */
  bench: number;
  total: number;
  /** points per start; null without a start */
  ppg: number | null;
  /** season rank among NFL players at the position, by points */
  posRank: number | null;
}

export interface PositionGroup {
  pos: string;
  /** started points at this position */
  started: number;
  /** started + bench points */
  roster: number;
  /** share of this team's started points */
  share: number;
  /** share of the league's started points */
  leagueShare: number;
  /** rank of started points among the league's teams */
  rank: number;
  players: PositionPlayer[];
}

export interface SeasonProfile {
  year: number; userId: UserId; status: SeasonStatus; row: StandingRow | undefined; teams: number;
  teamName: string; displayName: string; avatar: string | null;
  scoringRank: number;
  /** 1 = fewest points allowed */
  pointsAllowedRank: number;
  /** rank of regular-season lineup efficiency */
  efficiencyRank: number;
  finish: Finish;
  /** regular-season rank: the playoff seed once the season is complete, the current one before */
  seed: number | null;
  playoffSpots: number;
  /** in the winners bracket for a complete season; inside the top `playoffSpots` before */
  madePlayoffs: boolean;
  faab: number;
  /** points / ceiling over every played game */
  efficiency: number;
  /** played games, in week order */
  weeks: WeekLine[];
  /** played games, upcoming matchups and playoff byes, in week order */
  schedule: ScheduleEntry[];
  weeksPlayed: number;
  /** points per week, and the league's */
  ppw: number; leagueAvgPpw: number;
  positions: PositionGroup[];
  neverStarted: PositionPlayer[];
  picks: DraftPick[]; grade: string | null; draftValue: number | null; draftRank: number | null;
  moves: Transaction[];
  bestStarts: BestStart[];
  bestWaiverStarts: BestStart[];
  bestPickup: { playerId: PlayerId; points: number; starts: number; week: number; bid: number | null } | null;
}

/** Longest run of wins over games in chronological order. */
export function longestWinStreak(games: TeamGame[]): number {
  let best = 0, run = 0;
  for (const g of [...games].sort((a, b) => a.year - b.year || a.week - b.week)) {
    run = g.result === 'W' ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Everything one manager's season page shows. */
export function seasonProfile(season: Season, userId: UserId, players: PlayerDirectory): SeasonProfile {
  const row = season.standings.find((r) => r.userId === userId);
  const rows = season.standings;
  const manager = season.managers[userId];
  const games = teamGamesOf([season]).filter((g) => g.userId === userId);
  const played = season.weeks.filter((w) => w.played);

  const weeks: WeekLine[] = games.map((g) => ({
    week: g.week, tag: g.tag, isPlayoff: g.isPlayoff, matchupId: g.matchupId, opponentId: g.opponentId,
    points: g.points, oppPoints: g.oppPoints, result: g.result, leagueAvg: leagueAvgOf(season.weeks[g.week - 1]),
    high: false, low: false,
  })).sort((a, b) => a.week - b.week);
  if (weeks.length > 0) {
    const max = Math.max(...weeks.map((w) => w.points)), min = Math.min(...weeks.map((w) => w.points));
    for (const w of weeks) { w.high = w.points === max; w.low = w.points === min && max !== min; }
  }
  const schedule: ScheduleEntry[] = [];
  for (const wk of season.weeks) {
    const game = wk.games.find((g) => g.sides.some((s) => s.userId === userId));
    if (wk.played) {
      const line = weeks.find((w) => w.week === wk.week);
      if (line) schedule.push({ kind: 'played', ...line });
      else if (wk.isPlayoff && season.weeks.some((later) => later.week > wk.week && later.games.some((g) => g.sides.some((s) => s.userId === userId)))) schedule.push({ kind: 'bye', week: wk.week, leagueAvg: leagueAvgOf(wk) });
    } else if (game) {
      const me = game.sides.find((s) => s.userId === userId)!, opp = game.sides.find((s) => s.userId !== userId)!;
      schedule.push({ kind: 'upcoming', week: wk.week, tag: game.tag, isPlayoff: wk.isPlayoff, matchupId: game.matchupId, opponentId: opp.userId, projected: me.projected, oppProjected: opp.projected });
    }
  }
  const allSides = played.flatMap((w) => w.games.flatMap((g) => g.sides));
  const ppw = weeks.length ? round1(weeks.reduce((t, w) => t + w.points, 0) / weeks.length) : 0;
  const leagueAvgPpw = allSides.length ? round1(allSides.reduce((t, s) => t + s.points, 0) / allSides.length) : 0;

  // Points by position: this team's started/bench points per player, and the league's started points per position.
  const byPlayer = new Map<PlayerId, PositionPlayer>();
  const posOf = (id: PlayerId) => players[id]?.position ?? '?';
  const leagueStarted = new Map<string, Map<UserId, number>>();
  for (const wk of played) {
    for (const g of wk.games) {
      for (const sd of g.sides) {
        for (const e of sd.starters) {
          if (!e.player) continue;
          const pos = posOf(e.player.playerId);
          const m = leagueStarted.get(pos) ?? new Map<UserId, number>();
          m.set(sd.userId, (m.get(sd.userId) ?? 0) + e.player.points);
          leagueStarted.set(pos, m);
        }
        if (sd.userId !== userId) continue;
        const touch = (id: PlayerId) => byPlayer.get(id) ?? byPlayer.set(id, { playerId: id, position: posOf(id), started: 0, starts: 0, high: 0, bench: 0, total: 0, ppg: null, posRank: season.playerSeasons[id]?.posRank ?? null }).get(id)!;
        for (const e of sd.starters) {
          if (!e.player) continue;
          const p = touch(e.player.playerId);
          p.started += e.player.points; p.starts += 1; p.high = Math.max(p.high, e.player.points); p.total += e.player.points;
        }
        for (const l of sd.bench) { const p = touch(l.playerId); p.bench += l.points; p.total += l.points; }
      }
    }
  }
  for (const p of byPlayer.values()) { p.started = round2(p.started); p.bench = round2(p.bench); p.total = round2(p.total); p.high = round2(p.high); p.ppg = p.starts > 0 ? round2(p.started / p.starts) : null; }
  const myStartedTotal = [...byPlayer.values()].reduce((t, p) => t + p.started, 0);
  const leagueStartedTotal = [...leagueStarted.values()].reduce((t, m) => t + [...m.values()].reduce((a, b) => a + b, 0), 0);
  const positions: PositionGroup[] = PROFILE_POSITIONS.map((pos) => {
    const mine = [...byPlayer.values()].filter((p) => p.position === pos && p.starts > 0).sort((a, b) => b.started - a.started || b.total - a.total);
    const started = round2(mine.reduce((t, p) => t + p.started, 0));
    const roster = round2([...byPlayer.values()].filter((p) => p.position === pos).reduce((t, p) => t + p.total, 0));
    const league = leagueStarted.get(pos) ?? new Map<UserId, number>();
    const leaguePos = [...league.values()].reduce((a, b) => a + b, 0);
    return {
      pos, started, roster,
      share: myStartedTotal > 0 ? started / myStartedTotal : 0,
      leagueShare: leagueStartedTotal > 0 ? leaguePos / leagueStartedTotal : 0,
      rank: rankOf(started, [...league.values()], (a, b) => a > b),
      players: mine,
    };
  });
  const neverStarted = [...byPlayer.values()].filter((p) => p.starts === 0).sort((a, b) => b.total - a.total);

  const draft = season.draft;
  const picks = draft ? draft.picks.filter((p) => p.userId === userId).sort((a, b) => a.pickNo - b.pickNo) : [];
  const summaries = draft ? managerDraftSummaries(draft) : [];
  const draftIdx = summaries.findIndex((s) => s.userId === userId);
  const graded = draftIdx >= 0 && summaries[draftIdx].valued > 0;

  const moves = season.transactions.filter((t) => involves(t, userId)).sort((a, b) => b.created - a.created);
  const faab = moves.filter((t) => t.type === 'waiver' && t.adds.some((m) => m.userId === userId)).reduce((t, x) => t + (x.bid ?? 0), 0);
  const claims = waiverClaims([{ year: season.year, transactions: season.transactions }], flattenLines([season], players)).filter((c) => c.userId === userId && c.starts > 0);
  const best = claims.sort((a, b) => b.points - a.points || a.week - b.week)[0];

  const ceilingTotal = games.reduce((t, g) => t + g.ceiling, 0);
  const inBracket = season.brackets.winners.some((b) => b.home === userId || b.away === userId);
  const top = bestStarts(season, userId);
  return {
    year: season.year, userId, status: season.status, row, teams: rows.length,
    teamName: manager?.teamName ?? manager?.displayName ?? userId, displayName: manager?.displayName ?? userId, avatar: manager?.avatar ?? null,
    scoringRank: row ? rankOf(row.pf, rows.map((r) => r.pf), (a, b) => a > b) : rows.length,
    pointsAllowedRank: row ? rankOf(row.pa, rows.map((r) => r.pa), (a, b) => a < b) : rows.length,
    efficiencyRank: row ? rankOf(row.efficiency, rows.map((r) => r.efficiency), (a, b) => a > b) : rows.length,
    finish: finishOf(season, userId),
    seed: row?.rank ?? null,
    playoffSpots: season.playoffTeams,
    madePlayoffs: season.status === 'complete' ? inBracket : row !== undefined && row.rank <= season.playoffTeams,
    faab,
    efficiency: ceilingTotal > 0 ? games.reduce((t, g) => t + g.points, 0) / ceilingTotal : 0,
    weeks, schedule, weeksPlayed: weeks.length, ppw, leagueAvgPpw,
    positions, neverStarted,
    picks,
    grade: graded ? letterGrade(draftIdx + 1, summaries.length) : null,
    draftValue: graded ? summaries[draftIdx].totalValue : null,
    draftRank: graded ? draftIdx + 1 : null,
    moves,
    bestStarts: top.all, bestWaiverStarts: top.waiver,
    bestPickup: best ? { playerId: best.playerId, points: best.points, starts: best.starts, week: best.week, bid: best.bid } : null,
  };
}

export interface FieldedAs { teamName: string; from: number; to: number }

/** Distinct team names with the contiguous year ranges they covered, newest first. */
export function fieldedAs(seasons: Season[], userId: UserId): FieldedAs[] {
  const out: FieldedAs[] = [];
  for (const s of [...seasons].sort((a, b) => a.year - b.year)) {
    const m = s.managers[userId];
    if (!m) continue;
    const teamName = m.teamName ?? m.displayName;
    const last = out[out.length - 1];
    if (last && last.teamName === teamName && last.to === s.year - 1) last.to = s.year;
    else out.push({ teamName, from: s.year, to: s.year });
  }
  return out.reverse();
}

export interface FranchisePlayer {
  playerId: PlayerId; position: string; from: number; to: number; seasons: number;
  /** distinct weeks on the roster */
  weeks: number;
  starts: number;
  /** points while started */
  started: number;
  high: number;
}

/** Longest tenures, biggest production: ranked on weeks rostered, then points started. */
export function franchisePlayers(lines: PlayerLine[], userId: UserId, n = 6): FranchisePlayer[] {
  const acc = new Map<PlayerId, FranchisePlayer & { weekKeys: Set<string>; years: Set<number> }>();
  for (const l of lines) {
    if (l.userId !== userId) continue;
    const f = acc.get(l.playerId) ?? acc.set(l.playerId, { playerId: l.playerId, position: l.position, from: l.year, to: l.year, seasons: 0, weeks: 0, starts: 0, started: 0, high: 0, weekKeys: new Set(), years: new Set() }).get(l.playerId)!;
    f.weekKeys.add(`${l.year}-${l.week}`); f.years.add(l.year);
    f.from = Math.min(f.from, l.year); f.to = Math.max(f.to, l.year);
    if (l.started) { f.starts += 1; f.started += l.points; f.high = Math.max(f.high, l.points); }
  }
  return [...acc.values()]
    .map(({ weekKeys, years, ...f }) => ({ ...f, weeks: weekKeys.size, seasons: years.size, started: round2(f.started), high: round2(f.high) }))
    .sort((a, b) => b.weeks - a.weeks || b.started - a.started || (a.playerId < b.playerId ? -1 : 1))
    .slice(0, n);
}

export interface LineupDesk {
  weeks: number; efficiency: number; started: number; possible: number; benchLeft: number;
  /** highest-efficiency game */
  best: TeamGame | null;
  /** most bench points left */
  worst: TeamGame | null;
}

export function lineupDesk(games: TeamGame[]): LineupDesk {
  const played = games.filter((g) => g.ceiling > 0);
  const started = round2(played.reduce((t, g) => t + g.points, 0));
  const possible = round2(played.reduce((t, g) => t + g.ceiling, 0));
  const eff = (g: TeamGame) => g.points / g.ceiling;
  return {
    weeks: played.length, efficiency: possible > 0 ? started / possible : 0, started, possible,
    benchLeft: round1(played.reduce((t, g) => t + g.benchPoints, 0)),
    best: played.reduce<TeamGame | null>((b, g) => (!b || eff(g) > eff(b) ? g : b), null),
    worst: played.reduce<TeamGame | null>((b, g) => (!b || g.benchPoints > b.benchPoints ? g : b), null),
  };
}

/** a pick tagged with the draft's team count, for `pickLabel` */
export type DeskPick = DraftPick & { teams: number };
export interface DraftYear {
  year: number; grade: string; value: number; rank: number; teams: number;
  /** highest-value pick that year */
  steal: DeskPick | null;
  /** lowest-value pick that year */
  bust: DeskPick | null;
}
export interface DraftDesk {
  drafts: number; avgGrade: string; valuePerDraft: number;
  /** newest first */
  seasons: DraftYear[];
}

/** Career draft summary over every graded draft, one row per year with its steal and bust; null when none is graded. */
export function draftDesk(seasons: Season[], userId: UserId): DraftDesk | null {
  const lines: DraftYear[] = [];
  for (const s of seasons) {
    if (!s.draft) continue;
    const summaries = managerDraftSummaries(s.draft);
    const idx = summaries.findIndex((x) => x.userId === userId);
    if (idx < 0 || summaries[idx].valued === 0) continue;
    const teams = s.draft.slotOrder.length;
    let steal: DeskPick | null = null, bust: DeskPick | null = null;
    for (const p of s.draft.picks) {
      if (p.userId !== userId || p.value === null) continue;
      if (!steal || p.value > steal.value!) steal = { ...p, teams };
      if (!bust || p.value < bust.value!) bust = { ...p, teams };
    }
    lines.push({ year: s.year, grade: letterGrade(idx + 1, summaries.length), value: summaries[idx].totalValue, rank: idx + 1, teams: summaries.length, steal, bust });
  }
  if (lines.length === 0) return null;
  const career = lines.reduce((t, l) => t + l.value, 0);
  const meanRank = lines.reduce((t, l) => t + l.rank, 0) / lines.length;
  const meanTeams = lines.reduce((t, l) => t + l.teams, 0) / lines.length;
  return {
    drafts: lines.length, avgGrade: letterGrade(Math.round(meanRank), Math.round(meanTeams)), valuePerDraft: round1(career / lines.length),
    seasons: lines.sort((a, b) => b.year - a.year),
  };
}

export interface CareerSeasonLine {
  year: number; status: SeasonStatus; row: StandingRow | undefined; teamName: string;
  finish: string; finishIcon: FinishKind | null; champion: boolean; runnerUp: boolean; third: boolean; pointsTitle: boolean; lastPlace: boolean; playoffBerth: boolean;
  ppw: number; leagueAvgPpw: number;
  grade: string | null; draftValue: number | null;
  moves: number;
}

export interface Rivalry {
  opponentId: UserId; w: number; l: number; t: number; pf: number; pa: number;
  games: number; winPct: number;
  /** my consecutive wins (positive) or losses (negative) at the end of the series */
  streak: number;
}

export interface CareerProfile {
  userId: UserId; name: string; avatar: string | null;
  allTime: History['allTime'][number] | undefined; managers: number;
  record: WLT; winPct: number; pf: number; pa: number;
  playoffApps: number; titles: number; bestFinish: string;
  fieldedAs: FieldedAs[];
  seasons: CareerSeasonLine[];
  honors: Record<'champion' | 'runnerUp' | 'third' | 'pointsTitle' | 'lastPlace', number[]>;
  rivalries: Rivalry[];
  lineup: LineupDesk;
  draft: DraftDesk | null;
  franchise: FranchisePlayer[];
  longestWinStreak: number;
  weekHighs: number;
}

/** `1st` before `2nd` before `10th`; `—` last */
const finishKey = (f: string) => parseInt(f, 10) || 999;

/** Everything one manager's career page shows. */
export function careerProfile(seasons: Season[], history: History, userId: UserId, players: PlayerDirectory): CareerProfile {
  const games = teamGamesOf(seasons).filter((g) => g.userId === userId);
  const mine = seasons.filter((s) => s.standings.some((r) => r.userId === userId)).sort((a, b) => b.year - a.year);
  const lines: CareerSeasonLine[] = mine.map((s) => {
    const row = s.standings.find((r) => r.userId === userId);
    const h = s.honors;
    const my = games.filter((g) => g.year === s.year);
    const all = s.weeks.filter((w) => w.played).flatMap((w) => w.games.flatMap((g) => g.sides.map((x) => x.points)));
    const summaries = s.draft ? managerDraftSummaries(s.draft) : [];
    const idx = summaries.findIndex((x) => x.userId === userId);
    const graded = idx >= 0 && summaries[idx].valued > 0;
    const m = s.managers[userId];
    const fin = finishOf(s, userId);
    return {
      year: s.year, status: s.status, row, teamName: m?.teamName ?? m?.displayName ?? userId, finish: fin.label, finishIcon: fin.icon,
      champion: h.champion === userId, runnerUp: h.runnerUp === userId, third: h.third === userId, pointsTitle: h.pointsTitle === userId, lastPlace: h.lastPlace === userId,
      playoffBerth: s.brackets.winners.some((b) => b.home === userId || b.away === userId),
      ppw: my.length ? round1(my.reduce((t, g) => t + g.points, 0) / my.length) : 0,
      leagueAvgPpw: all.length ? round1(all.reduce((t, p) => t + p, 0) / all.length) : 0,
      grade: graded ? letterGrade(idx + 1, summaries.length) : null,
      draftValue: graded ? summaries[idx].totalValue : null,
      moves: s.transactions.filter((t) => involves(t, userId)).length,
    };
  });
  const honors = { champion: [] as number[], runnerUp: [] as number[], third: [] as number[], pointsTitle: [] as number[], lastPlace: [] as number[] };
  for (const l of lines) for (const k of Object.keys(honors) as (keyof typeof honors)[]) if (l[k]) honors[k].push(l.year);

  const rivalries: Rivalry[] = Object.values(history.h2h)
    .filter((s) => s.a === userId || s.b === userId)
    .map((s) => {
      const me = s.a === userId;
      const ordered = [...s.games].sort((x, y) => x.year - y.year || x.week - y.week);
      let streak = 0;
      for (const g of ordered) {
        const my = me ? g.aPoints : g.bPoints, their = me ? g.bPoints : g.aPoints;
        const r = my > their ? 1 : my < their ? -1 : 0;
        streak = r === 0 ? 0 : (Math.sign(streak) === r ? streak + r : r);
      }
      const w = me ? s.aWins : s.bWins, l = me ? s.bWins : s.aWins, t = s.ties;
      const n = w + l + t;
      return { opponentId: me ? s.b : s.a, w, l, t, pf: me ? s.totalPoints.a : s.totalPoints.b, pa: me ? s.totalPoints.b : s.totalPoints.a, games: n, winPct: n ? (w + t / 2) / n : 0, streak };
    })
    .filter((r) => r.games > 0)
    .sort((x, y) => y.winPct - x.winPct || y.games - x.games || (x.opponentId < y.opponentId ? -1 : 1));

  const rows = lines.map((l) => l.row).filter((r): r is StandingRow => r !== undefined);
  const record: WLT = { w: rows.reduce((t, r) => t + r.w, 0), l: rows.reduce((t, r) => t + r.l, 0), t: rows.reduce((t, r) => t + r.t, 0) };
  const played = record.w + record.l + record.t;
  const finishes = lines.map((l) => l.finish).filter((f) => f !== '—');
  const bestFinish = finishes.sort((a, b) => finishKey(a) - finishKey(b))[0] ?? '—';

  const m = history.managers[userId];
  return {
    userId, name: m?.displayName ?? userId, avatar: m?.avatar ?? null,
    allTime: history.allTime.find((r) => r.userId === userId), managers: history.allTime.length,
    record, winPct: played ? (record.w + record.t / 2) / played : 0,
    pf: round2(rows.reduce((t, r) => t + r.pf, 0)), pa: round2(rows.reduce((t, r) => t + r.pa, 0)),
    playoffApps: lines.filter((l) => l.playoffBerth).length, titles: honors.champion.length, bestFinish,
    fieldedAs: fieldedAs(seasons, userId),
    seasons: lines,
    honors,
    rivalries,
    lineup: lineupDesk(games),
    draft: draftDesk(seasons, userId),
    franchise: franchisePlayers(flattenLines(seasons, players), userId, 12),
    longestWinStreak: longestWinStreak(games),
    weekHighs: games.filter((g) => g.weekHigh).length,
  };
}
