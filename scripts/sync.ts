import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SleeperClient, buildSeason, buildHistory, toPlayerDirectory, trimPlayers, collectPlayerIds, trimPlayerSeasons, weekTeams,
  runPerLeague, SeasonSchema, HistorySchema, PlayerDirectorySchema, scoreStats, round2, espnScoreboardUrl, scoredThrough, weekFinished,
  type PlayerDirectory, type RawSeasonInput, type Season, type SleeperLeague, type SleeperMatchup, type SleeperTransaction, type StatMap,
} from '@fantasy-dash/core';
import { leagues as configured, positionOverrides } from '../league.config';
import { moveKeep, idsFromSeasonFiles } from './lib/leagueFiles';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'data');
const dryRun = process.argv.includes('--dry-run');
const log = (msg: string) => console.log(`[sync] ${msg}`);
// Team games are credited from each week's stat rows (the team the player suited up for that week); a real game has 36+ players
// with gp >= 1. The threshold guards the fallback to the directory's current team, where bye-week stragglers reach ~21.
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

/**
 * Counts a week as scored the moment its last NFL game ends (ESPN), not a day or two later when Sleeper bumps
 * last_scored_leg. Every sync re-reads every week, so later stat corrections still land.
 */
async function withFinishedWeek(league: SleeperLeague): Promise<SleeperLeague> {
  if (league.status !== 'in_season' && league.status !== 'post_season') return league;
  const leg = league.settings.last_scored_leg ?? 0;
  const through = await scoredThrough(leg, async (week) => {
    const r = await fetch(espnScoreboardUrl(Number(league.season), week));
    if (!r.ok) throw new Error(`ESPN ${r.status}`);
    return weekFinished(await r.json());
  });
  if (through === leg) return league;
  log(`  ${league.season} week ${through}: every NFL game is final; counting it before Sleeper does (last_scored_leg ${leg})`);
  return { ...league, settings: { ...league.settings, last_scored_leg: through } };
}

async function fetchSeason(client: SleeperClient, league: SleeperLeague, players: PlayerDirectory, managerNames: Record<string, string>): Promise<Season> {
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
  const playerTeams: Record<string, string> = {};
  const transactions: SleeperTransaction[] = [];
  for (let week = 1; week <= maxWeek; week++) {
    const weekMatchups = (await client.getMatchups(id, week)) ?? [];
    matchups[week] = weekMatchups;
    const rostered = new Set(weekMatchups.flatMap((m) => m.players ?? []));
    const [proj, st, tx, weekRows] = await Promise.all([
      client.getProjections(league.season, week),
      client.getStats(league.season, week),
      client.getTransactions(id, week),
      client.getWeekStats(league.season, week),
    ]);
    if (week <= lastScoredLeg) {
      if (!proj) log(`WARNING: ${season} week ${week}: projections response was missing`);
      if (!st) log(`WARNING: ${season} week ${week}: stats response was missing`);
      if (!weekRows) log(`WARNING: ${season} week ${week}: weekly team rows were missing; falling back to current teams`);
    }
    if (st && week <= lastScoredLeg) {
      const teams = weekTeams(weekRows ?? []);
      Object.assign(playerTeams, teams);   // later weeks win, so a traded player ends on the team he finished with
      const playersPerTeam = new Map<string, number>();
      for (const [pid, line] of Object.entries(st)) {
        const pts = scoreStats(line, league.scoring_settings);
        if (pts !== 0) playerSeasonPoints[pid] = round2((playerSeasonPoints[pid] ?? 0) + pts);
        if ((line.gp ?? 0) >= 1) {
          playerGames[pid] = (playerGames[pid] ?? 0) + 1;
          const team = teams[pid] ?? players[pid]?.team;
          if (team) playersPerTeam.set(team, (playersPerTeam.get(team) ?? 0) + 1);
        }
      }
      for (const [team, n] of playersPerTeam) if (n >= TEAM_GAME_MIN_PLAYERS) teamGames[team] = (teamGames[team] ?? 0) + 1;
    }
    for (const t of tx ?? []) transactions.push(t);
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
    playerGames, teamGames, playerTeams, transactions,
  };
  log(`  ${season}: season points for ${Object.keys(playerSeasonPoints).length} players, teams for ${Object.keys(playerTeams).length}, ${transactions.length} transactions`);
  const built = buildSeason(input, managerNames);
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

async function main() {
  const client = new SleeperClient();

  log('Fetching player directory');
  const rawPlayers = await client.getPlayers();
  if (!rawPlayers) throw new Error('Player directory unavailable');
  const fullPlayers = toPlayerDirectory(rawPlayers);
  for (const [id, position] of Object.entries(positionOverrides)) {
    if (fullPlayers[id]) fullPlayers[id] = { ...fullPlayers[id], position };
    else log(`WARNING: position override for unknown player ${id}`);
  }

  const out = dryRun ? await mkdtemp(path.join(os.tmpdir(), 'fantasy-dash-')) : DATA_DIR;
  const { results, failed } = await runPerLeague(configured, async (cfg) => {
    const chain = await walkLeagueChain(client, cfg.leagueId);
    log(`${cfg.slug}: ${chain.length} seasons: ${chain.map((l) => l.season).join(', ')}`);
    const seasons: Season[] = [];
    for (const league of chain) {
      log(`${cfg.slug} ${league.season} (${league.league_id}, ${league.status})`);
      seasons.push(await fetchSeason(client, await withFinishedWeek(league), fullPlayers, cfg.managerNames));
    }
    seasons.sort((a, b) => a.year - b.year);
    return seasons;
  }, log);
  if (results.size === 0) throw new Error(`every league failed: ${failed.join(', ')}`);

  // players.json covers every league; a league that failed keeps the ids from its existing files
  const ids = new Set<string>();
  for (const seasons of results.values()) for (const id of collectPlayerIds(seasons)) ids.add(id);
  for (const slug of failed) for (const id of idsFromSeasonFiles(path.join(DATA_DIR, 'leagues', slug, 'seasons'))) ids.add(id);
  const players = trimPlayers(fullPlayers, ids);
  const kept = new Set(Object.keys(players));
  PlayerDirectorySchema.parse(players);

  await mkdir(path.join(out, 'leagues'), { recursive: true });
  for (const [slug, raw] of results) {
    const seasons = raw.map((s) => trimPlayerSeasons(s, kept));
    const history = buildHistory(seasons);
    for (const s of seasons) SeasonSchema.parse(s);
    HistorySchema.parse(history);
    const missing = [...collectPlayerIds(seasons)].filter((id) => !players[id]);
    if (missing.length) log(`WARNING: ${slug}: ${missing.length} player ids missing from directory: ${missing.slice(0, 10).join(', ')}`);
    const staging = path.join(ROOT, '.tmp', 'leagues', slug);
    await rm(staging, { recursive: true, force: true });
    await mkdir(path.join(staging, 'seasons'), { recursive: true });
    await writeFile(path.join(staging, 'history.json'), JSON.stringify(history, null, 1));
    for (const s of seasons) await writeFile(path.join(staging, 'seasons', `${s.year}.json`), JSON.stringify(s));
    await moveKeep(staging, path.join(out, 'leagues', slug), ['points']);
    log(`${slug}: wrote ${seasons.length} seasons`);
  }
  await writeFile(path.join(out, 'players.json'), JSON.stringify(players));
  log(`${dryRun ? 'Dry run complete. Output in' : 'Wrote'} ${out}${failed.length ? ` (failed: ${failed.join(', ')})` : ''}`);
}

main().catch((err) => {
  console.error('[sync] FAILED:', err);
  process.exit(1);
});
