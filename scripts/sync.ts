import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SleeperClient, buildSeason, buildHistory, toPlayerDirectory, trimPlayers, collectPlayerIds,
  SeasonSchema, HistorySchema, PlayerDirectorySchema, scoreStats, round2,
  type PlayerDirectory, type RawSeasonInput, type Season, type SleeperLeague, type SleeperMatchup, type SleeperTransaction, type StatMap,
} from '@fantasy-dash/core';
import { leagueConfig } from '../league.config';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');
const dryRun = process.argv.includes('--dry-run');
const log = (msg: string) => console.log(`[sync] ${msg}`);
// The directory holds each player's CURRENT team, so a few traded players can appear on a bye week; a real game has 36+ (bye-week stragglers reach ~21).
const TEAM_GAME_MIN_PLAYERS = 25;

async function walkLeagueChain(client: SleeperClient, startId: string): Promise<SleeperLeague[]> {
  const out: SleeperLeague[] = [];
  const seen = new Set<string>();
  let id: string | null = startId;
  while (id && id !== '0' && !seen.has(id)) {
    seen.add(id);
    const league = await client.getLeague(id);
    if (!league) throw new Error(`League ${id} not found`);
    out.push(league);
    id = league.previous_league_id;
  }
  return out;
}

function pickIds(map: StatMap, ids: Set<string>): StatMap {
  const out: StatMap = {};
  for (const id of ids) if (map[id]) out[id] = map[id];
  return out;
}

async function fetchSeason(client: SleeperClient, league: SleeperLeague, players: PlayerDirectory): Promise<Season> {
  const id = league.league_id;
  const [users, rosters, winnersBracket, losersBracket] = await Promise.all([
    client.getUsers(id), client.getRosters(id), client.getWinnersBracket(id), client.getLosersBracket(id),
  ]);
  const season = league.season;
  const missing = (endpoint: string) =>
    new Error(`Season ${season} (${id}): ${endpoint} response was missing`);
  if (!users) throw missing('users');
  if (!rosters) throw missing('rosters');
  if (!winnersBracket) throw missing('winners_bracket');
  if (!losersBracket) throw missing('losers_bracket');
  if (users.length === 0) throw new Error(`Season ${season} (${id}): users response was empty`);
  if (rosters.length === 0) throw new Error(`Season ${season} (${id}): rosters response was empty`);

  const drafts = await client.getDrafts(id);
  if (!drafts) throw missing('drafts');
  const completed = drafts.find((d) => d.status === 'complete') ?? null;
  let draft: RawSeasonInput['draft'] = null;
  if (completed) {
    const picks = await client.getDraftPicks(completed.draft_id);
    if (!picks) throw missing(`draft ${completed.draft_id} picks`);
    if (picks.length === 0) throw new Error(`Season ${season} (${id}): draft ${completed.draft_id} has no picks`);
    draft = { draft: completed, picks };
    log(`  ${season} draft: ${picks.length} picks (${picks.filter((p) => p.is_keeper).length} keepers)`);
  } else {
    log(`  ${season} draft: none`);
  }

  const playoffWeekStart = league.settings.playoff_week_start;
  const lastScoredLeg = league.status === 'complete' ? Infinity : league.settings.last_scored_leg ?? 0;
  const rounds = winnersBracket.reduce((m, g) => Math.max(m, g.r), 0);
  const maxWeek = rounds > 0 ? playoffWeekStart + rounds - 1 : playoffWeekStart - 1;

  const matchups: Record<number, SleeperMatchup[]> = {};
  const projections: Record<number, StatMap> = {};
  const stats: Record<number, StatMap> = {};
  const playerSeasonPoints: Record<string, number> = {};
  const playerGames: Record<string, number> = {};
  const teamGames: Record<string, number> = {};
  const trades: SleeperTransaction[] = [];
  for (let week = 1; week <= maxWeek; week++) {
    const weekMatchups = (await client.getMatchups(id, week)) ?? [];
    matchups[week] = weekMatchups;
    const rostered = new Set(weekMatchups.flatMap((m) => m.players ?? []));
    const [proj, st, tx] = await Promise.all([
      client.getProjections(league.season, week),
      client.getStats(league.season, week),
      client.getTransactions(id, week),
    ]);
    if (week <= lastScoredLeg) {
      if (!proj) log(`WARNING: ${season} week ${week}: projections response was missing`);
      if (!st) log(`WARNING: ${season} week ${week}: stats response was missing`);
    }
    if (st && week <= lastScoredLeg) {
      const playersPerTeam = new Map<string, number>();
      for (const [pid, line] of Object.entries(st)) {
        const pts = scoreStats(line, league.scoring_settings);
        if (pts !== 0) playerSeasonPoints[pid] = round2((playerSeasonPoints[pid] ?? 0) + pts);
        if ((line.gp ?? 0) >= 1) {
          playerGames[pid] = (playerGames[pid] ?? 0) + 1;
          const team = players[pid]?.team;
          if (team) playersPerTeam.set(team, (playersPerTeam.get(team) ?? 0) + 1);
        }
      }
      for (const [team, n] of playersPerTeam) if (n >= TEAM_GAME_MIN_PLAYERS) teamGames[team] = (teamGames[team] ?? 0) + 1;
    }
    for (const t of tx ?? []) if (t.type === 'trade' && t.status === 'complete') trades.push(t);
    projections[week] = pickIds(proj ?? {}, rostered);
    stats[week] = pickIds(st ?? {}, rostered);
    log(`  ${league.season} week ${week}: ${weekMatchups.length} roster entries, ${rostered.size} players`);
  }

  const input: RawSeasonInput = {
    league,
    users,
    rosters,
    matchups,
    winnersBracket,
    losersBracket,
    projections,
    stats,
    players,
    draft,
    playerSeasonPoints,
    playerGames, teamGames, trades,
  };
  log(`  ${season}: season points for ${Object.keys(playerSeasonPoints).length} players, ${trades.length} trades`);
  const built = buildSeason(input, leagueConfig.managerNames);
  assertSeasonComplete(built, league);
  return built;
}

/** Throw if a built season is missing games or honors it must have. */
function assertSeasonComplete(season: Season, league: SleeperLeague): void {
  const expectedGames = Math.floor(league.total_rosters / 2);
  for (const wk of season.weeks) {
    if (!wk.played || wk.isPlayoff) continue;
    if (wk.games.length < expectedGames) {
      throw new Error(
        `Season ${season.year} (${league.league_id}): matchups for week ${wk.week} produced ` +
        `${wk.games.length} games, expected ${expectedGames}`,
      );
    }
  }
  if (season.status === 'complete') {
    for (const key of ['champion', 'runnerUp', 'lastPlace'] as const) {
      if (season.honors[key] === null) {
        throw new Error(`Season ${season.year} (${league.league_id}): complete season has no ${key} (check brackets)`);
      }
    }
  }
}

async function writeAll(dir: string, seasons: Season[], players: PlayerDirectory, history: ReturnType<typeof buildHistory>) {
  await mkdir(path.join(dir, 'seasons'), { recursive: true });
  await writeFile(path.join(dir, 'players.json'), JSON.stringify(players));
  await writeFile(path.join(dir, 'history.json'), JSON.stringify(history, null, 1));
  for (const s of seasons) await writeFile(path.join(dir, 'seasons', `${s.year}.json`), JSON.stringify(s));
}

async function main() {
  const client = new SleeperClient();
  const leagues = await walkLeagueChain(client, leagueConfig.leagueId);
  log(`Found ${leagues.length} seasons: ${leagues.map((l) => l.season).join(', ')}`);

  log('Fetching player directory');
  const rawPlayers = await client.getPlayers();
  if (!rawPlayers) throw new Error('Player directory unavailable');
  const fullPlayers = toPlayerDirectory(rawPlayers);
  for (const [id, position] of Object.entries(leagueConfig.positionOverrides)) {
    if (fullPlayers[id]) fullPlayers[id] = { ...fullPlayers[id], position };
    else log(`WARNING: position override for unknown player ${id}`);
  }

  const seasons: Season[] = [];
  for (const league of leagues) {
    log(`Season ${league.season} (${league.league_id}, ${league.status})`);
    seasons.push(await fetchSeason(client, league, fullPlayers));
  }
  seasons.sort((a, b) => a.year - b.year);

  const players = trimPlayers(fullPlayers, collectPlayerIds(seasons));
  const history = buildHistory(seasons);

  for (const s of seasons) SeasonSchema.parse(s);
  HistorySchema.parse(history);
  PlayerDirectorySchema.parse(players);
  log(`Validated ${seasons.length} seasons and ${Object.keys(players).length} players`);

  const missing = [...collectPlayerIds(seasons)].filter((id) => !players[id]);
  if (missing.length) log(`WARNING: ${missing.length} player ids missing from directory: ${missing.slice(0, 10).join(', ')}`);

  if (dryRun) {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'fantasy-dash-'));
    await writeAll(dir, seasons, players, history);
    log(`Dry run complete. Output in ${dir}`);
    return;
  }

  const staging = path.join(ROOT, '.tmp', 'data');
  await rm(staging, { recursive: true, force: true });
  await writeAll(staging, seasons, players, history);

  const backup = `${DATA_DIR}.old`;
  await rm(backup, { recursive: true, force: true });
  if (existsSync(DATA_DIR)) await rename(DATA_DIR, backup);
  await rename(staging, DATA_DIR);
  await rm(backup, { recursive: true, force: true });
  log(`Wrote ${DATA_DIR}`);
}

main().catch((err) => {
  console.error('[sync] FAILED:', err);
  process.exit(1);
});
