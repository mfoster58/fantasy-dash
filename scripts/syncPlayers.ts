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

/** Like fetchText, but a 404 is an error: these files must exist. */
async function requireText(url: string, what: string): Promise<string> {
  const text = await fetchText(url);
  if (text === null) throw new Error(`${what} download was missing (404): ${url}`);
  return text;
}

/** fetchText for optional files: warns when the file is missing. */
async function optionalText(url: string, year: number, name: string): Promise<string | null> {
  const text = await fetchText(url);
  if (text === null) log(`WARNING: ${year}: ${name} missing (404); its fields will be absent`);
  return text;
}

const rowsOf = (text: string | null) => (text ? [...parseCsv(text)] : []);

/**
 * Merge several `${id}|${week}` maps; earlier maps win on a shared key.
 * The nflverse weekly file and NGS passing both write `pa_cpoe`; the earlier map (nflverse weekly) wins on purpose.
 */
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
    if (!rows) {
      if (complete) throw new Error(`${year} week ${week}: Sleeper weekly rows missing for a finished season`);
      log(`WARNING: ${year} week ${week}: Sleeper weekly rows missing`);
      continue;
    }
    sleeperWeeks.set(week, rows);
    if (proj) projections.set(week, proj);
  }

  const snaps = rowsOf(await optionalText(URLS.snaps(year), year, 'snap counts'));
  const crosswalk = buildCrosswalk(shared.crosswalkIds, shared.nflPlayers, snaps);
  const byGsis = mergeMaps(
    nflverseWeekly(rowsOf(await requireText(URLS.weekly(year), `${year} weekly stats`))),
    ngsWeekly(shared.ngsRec, year, NGS_RECEIVING_FIELDS),
    ngsWeekly(shared.ngsRush, year, NGS_RUSHING_FIELDS),
    ngsWeekly(shared.ngsPass, year, NGS_PASSING_FIELDS),
  );
  const byPfr = mergeMaps(
    pfrWeekly(rowsOf(await optionalText(URLS.pfrRec(year), year, 'PFR receiving')), PFR_REC_FIELDS),
    pfrWeekly(rowsOf(await optionalText(URLS.pfrRush(year), year, 'PFR rushing')), PFR_RUSH_FIELDS),
    pfrWeekly(rowsOf(await optionalText(URLS.pfrPass(year), year, 'PFR passing')), PFR_PASS_FIELDS),
    pfrWeekly(snaps, SNAP_FIELDS),
  );

  let participation: PlayerDbInput['participation'] = null;
  if (complete) {
    const text = await optionalText(URLS.participation(year), year, 'participation');
    if (text) {
      // Route runners: every RB/WR/TE gsis id in the nflverse player list.
      const runners = new Set(shared.nflPlayers.filter((p) => ['RB', 'WR', 'TE'].includes(p.position) && p.gsis_id).map((p) => p.gsis_id));
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
  const chain = await walkLeagueChain(client, leagueConfig.leagueId);
  if (onlySeason !== null && !(Number.isInteger(onlySeason) && chain.some((l) => Number(l.season) === onlySeason))) {
    throw new Error(`--season must name a league season (have: ${chain.map((l) => l.season).join(', ')})`);
  }
  const leagues = chain.filter((l) => onlySeason === null || Number(l.season) === onlySeason);
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
    crosswalkIds: rowsOf(await requireText(URLS.ids, 'Id crosswalk')),
    nflPlayers: rowsOf(await requireText(URLS.players, 'nflverse player list')),
    ngsRec: rowsOf(await requireText(URLS.ngsReceiving, 'NGS receiving')),
    ngsRush: rowsOf(await requireText(URLS.ngsRushing, 'NGS rushing')),
    ngsPass: rowsOf(await requireText(URLS.ngsPassing, 'NGS passing')),
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
