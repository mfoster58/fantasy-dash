import type {
  Game, GameSide, Manager, PlayerDirectory, PlayerLine, Season, SeasonStatus,
  SlotEntry, UserId, Week, WLT,
} from './types';
import type {
  SleeperBracketGame, SleeperLeague, SleeperMatchup, SleeperRoster, SleeperUser, StatMap,
} from './sleeper/types';
import { round2, round4, scoreStats } from './scoring';
import { optimalLineup, optimalSwaps, type LineupPlayer } from './lineup';
import { computeHonors, resolveBracket, tagForGame } from './bracket';
import { computeStandings, isRegularSeason } from './standings';

export interface RawSeasonInput {
  league: SleeperLeague;
  users: SleeperUser[];
  rosters: SleeperRoster[];
  /** week -> matchups */
  matchups: Record<number, SleeperMatchup[]>;
  winnersBracket: SleeperBracketGame[];
  losersBracket: SleeperBracketGame[];
  /** week -> player_id -> projected stat line */
  projections: Record<number, StatMap>;
  /** week -> player_id -> actual stat line */
  stats: Record<number, StatMap>;
  players: PlayerDirectory;
}

/** Raw stat keys kept for box-score stat lines. Everything else is dropped. */
export const STAT_KEYS = [
  'pass_cmp', 'pass_att', 'pass_yd', 'pass_td', 'pass_int', 'pass_2pt',
  'rush_att', 'rush_yd', 'rush_td', 'rush_2pt',
  'rec', 'rec_tgt', 'rec_yd', 'rec_td', 'rec_2pt',
  'fum_lost',
  'fgm', 'fga', 'xpm', 'xpa',
  'pts_allow', 'yds_allow', 'sack', 'int', 'ff', 'fum_rec', 'def_td', 'safe', 'blk_kick',
] as const;

const NON_STARTING_SLOTS = new Set(['BN', 'IR', 'TAXI']);

export function buildManagers(
  users: SleeperUser[],
  rosters: SleeperRoster[],
  nameOverrides: Record<UserId, string>,
): Record<UserId, Manager> {
  const byId = new Map(users.map((u) => [u.user_id, u]));
  const managers: Record<UserId, Manager> = {};
  for (const r of rosters) {
    const user = r.owner_id ? byId.get(r.owner_id) : undefined;
    const userId = r.owner_id ?? `roster-${r.roster_id}`;
    managers[userId] = {
      userId,
      displayName: nameOverrides[userId] ?? user?.display_name ?? `Team ${r.roster_id}`,
      teamName: user?.metadata?.team_name ?? null,
      avatar: user?.avatar ?? null,
      rosterId: r.roster_id,
    };
  }
  return managers;
}

function pickStats(line: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!line) return out;
  for (const k of STAT_KEYS) {
    const v = line[k];
    if (typeof v === 'number' && v !== 0) out[k] = v;
  }
  return out;
}

export function buildSeason(input: RawSeasonInput, nameOverrides: Record<UserId, string> = {}): Season {
  const { league, players } = input;
  const year = Number(league.season);
  const status: SeasonStatus = league.status === 'complete' ? 'complete' : 'in_season';
  const playoffWeekStart = league.settings.playoff_week_start;
  const rosterSlots = league.roster_positions.filter((p) => !NON_STARTING_SLOTS.has(p));
  const scoring = league.scoring_settings;

  const managers = buildManagers(input.users, input.rosters, nameOverrides);
  const rosterToUser: Record<number, UserId> = {};
  for (const m of Object.values(managers)) rosterToUser[m.rosterId] = m.userId;

  const rounds = input.winnersBracket.reduce((max, g) => Math.max(max, g.r), 0);
  const maxWeek = rounds > 0 ? playoffWeekStart + rounds - 1 : playoffWeekStart - 1;
  const lastScoredWeek = status === 'complete'
    ? maxWeek
    : Math.min(league.settings.last_scored_leg ?? 0, maxWeek);

  const matchupFor = (week: number, userId: UserId): SleeperMatchup | undefined => {
    const rosterId = managers[userId]?.rosterId;
    return (input.matchups[week] ?? []).find((m) => m.roster_id === rosterId);
  };
  const weekPoints = (week: number, userId: UserId): number | null => {
    if (week > lastScoredWeek) return null;
    const m = matchupFor(week, userId);
    return m ? m.custom_points ?? m.points ?? 0 : null;
  };

  const winners = resolveBracket(input.winnersBracket, 'winners', playoffWeekStart, rosterToUser, weekPoints);
  const consolation = resolveBracket(input.losersBracket, 'consolation', playoffWeekStart, rosterToUser, weekPoints);
  const allBracketGames = [...winners, ...consolation];

  const weeks: Week[] = [];
  for (let week = 1; week <= maxWeek; week++) {
    const played = week <= lastScoredWeek;
    const isPlayoff = !isRegularSeason(week, playoffWeekStart);
    const games = buildGames(week, input.matchups[week] ?? [], {
      year, played, rosterSlots, scoring, players, rosterToUser,
      projections: input.projections[week] ?? {},
      stats: input.stats[week] ?? {},
      tag: (a, b) => tagForGame(allBracketGames, week, a, b),
    });
    let highScore: UserId | null = null;
    if (played && !isPlayoff) {
      const top = games.flatMap((g) => g.sides)
        .reduce<GameSide | null>((best, s) => (!best || s.points > best.points ? s : best), null);
      highScore = top?.userId ?? null;
    }
    weeks.push({ week, isPlayoff, played, games, highScore });
  }

  annotateRecords(weeks, playoffWeekStart);

  for (const bg of allBracketGames) {
    const wk = weeks[bg.week - 1];
    const g = wk?.games.find((x) =>
      bg.home && bg.away &&
      x.sides.some((s) => s.userId === bg.home) &&
      x.sides.some((s) => s.userId === bg.away));
    bg.gameId = g?.id ?? null;
  }

  const standings = computeStandings(weeks, Object.keys(managers), playoffWeekStart);
  const honors = computeHonors(winners, consolation, standings, status);

  return {
    year,
    leagueId: league.league_id,
    status,
    lastScoredWeek,
    playoffWeekStart,
    playoffTeams: league.settings.playoff_teams,
    rosterSlots,
    scoring,
    managers,
    weeks,
    brackets: { winners, consolation },
    standings,
    honors,
  };
}

interface GameContext {
  year: number;
  played: boolean;
  rosterSlots: string[];
  scoring: Record<string, number>;
  players: PlayerDirectory;
  rosterToUser: Record<number, UserId>;
  projections: StatMap;
  stats: StatMap;
  tag: (a: UserId, b: UserId) => Game['tag'];
}

function buildGames(week: number, matchups: SleeperMatchup[], ctx: GameContext): Game[] {
  const byMatchup = new Map<number, SleeperMatchup[]>();
  for (const m of matchups) {
    if (m.matchup_id == null) continue;
    const list = byMatchup.get(m.matchup_id) ?? [];
    list.push(m);
    byMatchup.set(m.matchup_id, list);
  }
  const games: Game[] = [];
  for (const [matchupId, pair] of [...byMatchup.entries()].sort((x, y) => x[0] - y[0])) {
    if (pair.length !== 2) continue;
    const sides = pair.map((m) => buildSide(m, ctx)) as [GameSide, GameSide];
    const [a, b] = sides;
    const decided = ctx.played && a.points !== b.points;
    games.push({
      id: `${ctx.year}-${week}-${matchupId}`,
      matchupId,
      week,
      tag: ctx.tag(a.userId, b.userId),
      sides,
      winner: decided ? (a.points > b.points ? a.userId : b.userId) : null,
      margin: ctx.played ? round2(Math.abs(a.points - b.points)) : 0,
    });
  }
  return games;
}

function buildSide(m: SleeperMatchup, ctx: GameContext): GameSide {
  const userId = ctx.rosterToUser[m.roster_id] ?? `roster-${m.roster_id}`;
  const pp = m.players_points ?? {};

  const line = (id: string): PlayerLine => {
    const proj = ctx.projections[id];
    return {
      playerId: id,
      points: round2(pp[id] ?? 0),
      projected: proj ? scoreStats(proj, ctx.scoring) : null,
      stats: pickStats(ctx.stats[id]),
    };
  };

  const starterIds = (m.starters ?? []).map((id) => (id && id !== '0' ? id : null));
  const starters: SlotEntry[] = ctx.rosterSlots.map((slot, i) => {
    const id = starterIds[i] ?? null;
    return { slot, player: id ? line(id) : null };
  });
  const starterSet = new Set(starterIds.filter((id): id is string => id !== null));
  const allIds = m.players ?? [];
  const bench = allIds.filter((id) => !starterSet.has(id)).map(line).sort((x, y) => y.points - x.points);

  const lineupPlayers: LineupPlayer[] = allIds.map((id) => ({
    playerId: id,
    position: ctx.players[id]?.position ?? null,
    points: pp[id] ?? 0,
  }));
  const infoById = new Map(lineupPlayers.map((p) => [p.playerId, p]));
  const optimal = optimalLineup(ctx.rosterSlots, lineupPlayers);

  const points = round2(m.custom_points ?? m.points ?? 0);
  const projected = round2(starters.reduce((s, e) => s + (e.player?.projected ?? 0), 0));
  const swaps = ctx.played
    ? optimalSwaps(starterIds, optimal, (id) => infoById.get(id) ?? { playerId: id, position: null, points: 0 })
    : [];

  return {
    userId,
    points,
    projected,
    ceiling: optimal.total,
    efficiency: optimal.total > 0 ? round4(points / optimal.total) : 0,
    starters,
    bench,
    optimalSwaps: swaps,
    recordBefore: { w: 0, l: 0, t: 0 },
    seasonPpg: 0,
  };
}

/** Fill recordBefore (regular-season record entering the week) and seasonPpg. */
function annotateRecords(weeks: Week[], playoffWeekStart: number): void {
  const rec = new Map<UserId, WLT & { pf: number; games: number }>();
  const get = (u: UserId) => {
    let r = rec.get(u);
    if (!r) { r = { w: 0, l: 0, t: 0, pf: 0, games: 0 }; rec.set(u, r); }
    return r;
  };
  for (const wk of weeks) {
    for (const g of wk.games) {
      for (const s of g.sides) {
        const r = get(s.userId);
        s.recordBefore = { w: r.w, l: r.l, t: r.t };
      }
    }
    if (!wk.played || !isRegularSeason(wk.week, playoffWeekStart)) continue;
    for (const g of wk.games) {
      g.sides.forEach((s, i) => {
        const o = g.sides[1 - i];
        const r = get(s.userId);
        r.pf += s.points;
        r.games += 1;
        if (s.points > o.points) r.w += 1;
        else if (s.points < o.points) r.l += 1;
        else r.t += 1;
      });
    }
  }
  for (const wk of weeks) {
    for (const g of wk.games) {
      for (const s of g.sides) {
        const r = get(s.userId);
        s.seasonPpg = r.games ? round2(r.pf / r.games) : 0;
      }
    }
  }
}
