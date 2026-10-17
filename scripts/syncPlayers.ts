import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import {
  SleeperClient, PlayerDbSchema, buildPlayerDb, buildCrosswalk, countRoutes, nflPlayerMeta, nflverseWeekly, ngsWeekly, parseCsv, pfrWeekly,
  NGS_PASSING_FIELDS, NGS_RECEIVING_FIELDS, NGS_RUSHING_FIELDS, PFR_PASS_FIELDS, PFR_REC_FIELDS, PFR_RUSH_FIELDS, SNAP_FIELDS,
  type PlayerDbInput, type SleeperLeague, type SleeperWeekStat, type StatMap, type WeekFields,
} from '@fantasy-dash/core';
import { leagueConfig } from '../league.config';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'data', 'playerdb');
const args = process.argv.slice(2);
const full = args.includes('--full');
const dryRun = args.includes('--dry-run');
const onlySeason = args.includes('--season') ? Number(args[args.indexOf('--season') + 1]) : null;
const log = (msg: string) => console.log(`[sync:players] ${msg}`);

const NFLVERSE = 'https://github.com/nflverse/nflverse-data/releases/download';
const URLS = {
  ids: 'https://github.com/dynastyprocess/data/raw/master/files/db_playerids.csv',
  players: `${NFLVERSE}/players/players.csv`,
  ngsReceiving: `${NFLVERSE}/nextgen_stats/ngs_receiving.csv.gz`,
  ngsRushing: `${NFLVERSE}/nextgen_stats/ngs_rushing.csv.gz`,
  ngsPassing: `${NFLVERSE}/nextgen_stats/ngs_passing.csv.gz`,
  weekly: (y: number) => `${NFLVERSE}/stats_player/stats_player_week_${y}.csv`,
  pfrRec: (y: number) => `${NFLVERSE}/pfr_advstats/advstats_week_rec_${y}.csv`,
  pfrRush: (y: number) => `${NFLVERSE}/pfr_advstats/advstats_week_rush_${y}.csv`,
  pfrPass: (y: number) => `${NFLVERSE}/pfr_advstats/advstats_week_pass_${y}.csv`,
  snaps: (y: number) => `${NFLVERSE}/snap_counts/snap_counts_${y}.csv`,
  participation: (y: number) => `${NFLVERSE}/pbp_participation/pbp_participation_${y}.csv`,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Download a text or gzipped-text file; null on 404; retried three times on other failures. */
async function fetchText(url: string): Promise<string | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const text = url.endsWith('.gz') ? gunzipSync(buf).toString('utf8') : buf.toString('utf8');
      log(`  fetched ${url.split('/download/')[1] ?? url} (${(buf.length / 1e6).toFixed(1)} MB)`);
      return text;
    } catch (err) {
      if (attempt >= 3) throw err;
      await sleep(500 * 2 ** attempt);
    }
  }
}

const rowsOf = (text: string | null) => (text ? [...parseCsv(text)] : []);

/** Merge several `${id}|${week}` maps; earlier maps win on a shared key. */
function mergeMaps(...maps: Map<string, WeekFields>[]): Map<string, WeekFields> {
  const out = new Map<string, WeekFields>();
  for (const m of maps) for (const [k, v] of m) out.set(k, { ...v, ...(out.get(k) ?? {}) });
  return out;
}

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

interface Shared { crosswalkIds: Record<string, string>[]; nflPlayers: Record<string, string>[]; ngsRec: Record<string, string>[]; ngsRush: Record<string, string>[]; ngsPass: Record<string, string>[] }

async function buildSeason(client: SleeperClient, league: SleeperLeague, directory: PlayerDbInput['directory'], shared: Shared): Promise<ReturnType<typeof buildPlayerDb>> {
  const year = Number(league.season);
  const complete = league.status === 'complete';
  const throughWeek = complete ? 18 : Math.min(18, league.settings.last_scored_leg ?? 0);
  log(`${year}: ${complete ? 'finished' : `in season, through week ${throughWeek}`}`);

  const sleeperWeeks = new Map<number, SleeperWeekStat[]>();
  const projections = new Map<number, StatMap>();
  for (let week = 1; week <= throughWeek; week++) {
    const [rows, proj] = await Promise.all([client.getWeekStats(league.season, week), client.getProjections(league.season, week)]);
    if (!rows) { log(`WARNING: ${year} week ${week}: Sleeper weekly rows missing`); continue; }
    sleeperWeeks.set(week, rows);
    if (proj) projections.set(week, proj);
  }

  const snaps = rowsOf(await fetchText(URLS.snaps(year)));
  const crosswalk = buildCrosswalk(shared.crosswalkIds, shared.nflPlayers, snaps);
  const byGsis = mergeMaps(
    nflverseWeekly(rowsOf(await fetchText(URLS.weekly(year)))),
    ngsWeekly(shared.ngsRec, year, NGS_RECEIVING_FIELDS),
    ngsWeekly(shared.ngsRush, year, NGS_RUSHING_FIELDS),
    ngsWeekly(shared.ngsPass, year, NGS_PASSING_FIELDS),
  );
  const byPfr = mergeMaps(
    pfrWeekly(rowsOf(await fetchText(URLS.pfrRec(year))), PFR_REC_FIELDS),
    pfrWeekly(rowsOf(await fetchText(URLS.pfrRush(year))), PFR_RUSH_FIELDS),
    pfrWeekly(rowsOf(await fetchText(URLS.pfrPass(year))), PFR_PASS_FIELDS),
    pfrWeekly(snaps, SNAP_FIELDS),
  );

  let participation: PlayerDbInput['participation'] = null;
  if (complete) {
    const text = await fetchText(URLS.participation(year));
    if (text) {
      // Route runners: every RB/WR/TE gsis id the crosswalk can name, taken from the nflverse player list.
      const runners = new Set(shared.nflPlayers.filter((p) => ['RB', 'WR', 'TE'].includes(p.position)).map((p) => p.gsis_id));
      participation = countRoutes(parseCsv(text), runners);
      log(`  routes for ${participation.routes.size} player-weeks, pass plays for ${participation.passPlays.size} team-weeks`);
    } else {
      log(`  no participation file for ${year}; routes will be estimated`);
    }
  }

  const db = buildPlayerDb({
    year, throughWeek, builtAt: new Date().toISOString(), scoring: league.scoring_settings, positionOverrides: leagueConfig.positionOverrides,
    sleeperWeeks, projections, directory, crosswalk, byGsis, byPfr, nflPlayers: nflPlayerMeta(shared.nflPlayers), participation,
  });
  const unmapped = Object.values(db.players).filter((p) => !p.gsisId).length;
  log(`  ${db.rows.length} rows, ${Object.keys(db.players).length} players (${unmapped} without a gsis id), xfp fitted for ${Object.entries(db.xfp).filter(([, c]) => c).map(([p]) => p).join(' ') || 'nobody'}`);
  PlayerDbSchema.parse(db);
  return db;
}

async function main() {
  const client = new SleeperClient();
  const leagues = (await walkLeagueChain(client, leagueConfig.leagueId)).filter((l) => onlySeason === null || Number(l.season) === onlySeason);
  log(`Seasons: ${leagues.map((l) => l.season).join(', ')}`);

  const todo = leagues.filter((l) => {
    const finished = l.status === 'complete' && existsSync(path.join(OUT_DIR, `${l.season}.json`));
    if (finished && !full) log(`${l.season}: finished and already built, skipping (pass --full to rebuild)`);
    return !finished || full;
  });
  if (todo.length === 0) { log('Nothing to do'); return; }

  log('Fetching the Sleeper player directory');
  const directory = await client.getPlayers();
  if (!directory) throw new Error('Player directory unavailable');

  log('Fetching shared nflverse files');
  const shared: Shared = {
    crosswalkIds: rowsOf(await fetchText(URLS.ids)),
    nflPlayers: rowsOf(await fetchText(URLS.players)),
    ngsRec: rowsOf(await fetchText(URLS.ngsReceiving)),
    ngsRush: rowsOf(await fetchText(URLS.ngsRushing)),
    ngsPass: rowsOf(await fetchText(URLS.ngsPassing)),
  };
  if (shared.crosswalkIds.length === 0) throw new Error('Id crosswalk download was empty');

  const staging = dryRun ? await mkdtemp(path.join(os.tmpdir(), 'fantasy-dash-playerdb-')) : path.join(ROOT, '.tmp', 'playerdb');
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  const built: string[] = [];
  for (const league of todo) {
    const db = await buildSeason(client, league, directory, shared);
    const file = path.join(staging, `${db.year}.json`);
    await writeFile(file, JSON.stringify(db));
    built.push(file);
  }
  if (dryRun) { log(`Dry run complete. Output in ${staging}`); return; }
  await mkdir(OUT_DIR, { recursive: true });
  for (const file of built) await rename(file, path.join(OUT_DIR, path.basename(file)));
  await rm(staging, { recursive: true, force: true });
  log(`Wrote ${built.length} season file(s) to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error('[sync:players] FAILED:', err);
  process.exit(1);
});
