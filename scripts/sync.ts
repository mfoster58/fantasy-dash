import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SleeperClient, buildSeason, buildHistory, toPlayerDirectory, trimPlayers, collectPlayerIds,
  SeasonSchema, HistorySchema, PlayerDirectorySchema,
  type PlayerDirectory, type RawSeasonInput, type Season, type SleeperLeague, type SleeperMatchup, type StatMap,
} from '@fantasy-dash/core';
import { leagueConfig } from '../league.config';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DATA_DIR = path.join(ROOT, 'data');
const dryRun = process.argv.includes('--dry-run');
const log = (msg: string) => console.log(`[sync] ${msg}`);

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
  const playoffWeekStart = league.settings.playoff_week_start;
  const rounds = (winnersBracket ?? []).reduce((m, g) => Math.max(m, g.r), 0);
  const maxWeek = rounds > 0 ? playoffWeekStart + rounds - 1 : playoffWeekStart - 1;

  const matchups: Record<number, SleeperMatchup[]> = {};
  const projections: Record<number, StatMap> = {};
  const stats: Record<number, StatMap> = {};
  for (let week = 1; week <= maxWeek; week++) {
    const weekMatchups = (await client.getMatchups(id, week)) ?? [];
    matchups[week] = weekMatchups;
    const rostered = new Set(weekMatchups.flatMap((m) => m.players ?? []));
    const [proj, st] = await Promise.all([
      client.getProjections(league.season, week),
      client.getStats(league.season, week),
    ]);
    projections[week] = pickIds(proj ?? {}, rostered);
    stats[week] = pickIds(st ?? {}, rostered);
    log(`  ${league.season} week ${week}: ${weekMatchups.length} roster entries, ${rostered.size} players`);
  }

  const input: RawSeasonInput = {
    league,
    users: users ?? [],
    rosters: rosters ?? [],
    matchups,
    winnersBracket: winnersBracket ?? [],
    losersBracket: losersBracket ?? [],
    projections,
    stats,
    players,
  };
  return buildSeason(input, leagueConfig.managerNames);
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
