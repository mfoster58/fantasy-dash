import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import {
  SleeperClient, SharedPlayerDbSchema, LeaguePointsSchema, nflYears, runPerLeague, buildLeaguePoints, pointsUpToDate, ChartDbSchema, ScheduleSchema, buildCharts, parseSchedule, buildPlayerDb, isDbPos, buildCrosswalk, countRoutes, nflPlayerMeta, nflverseTeamAirYards, nflverseWeekly, ngsWeekly, parseCsv, pfrWeekly, snapCountTeamSnaps,
  NGS_PASSING_FIELDS, NGS_RECEIVING_FIELDS, NGS_RUSHING_FIELDS, PFR_PASS_FIELDS, PFR_REC_FIELDS, PFR_RUSH_FIELDS, SNAP_FIELDS,
  type DbPos, type NflYear, type PlayerDbInput, type SleeperLeague, type SleeperWeekStat, type StatMap, type WeekFields,
} from '@fantasy-dash/core';
import { leagues as configured, positionOverrides } from '../league.config';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'data', 'playerdb');
const CHART_DIR = path.join(ROOT, 'data', 'charts');
const SCHEDULE_DIR = path.join(ROOT, 'data', 'schedule');
const args = process.argv.slice(2);
const full = args.includes('--full');
const dryRun = args.includes('--dry-run');
const chartsOnly = args.includes('--charts-only');
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
  pbp: (y: number) => `${NFLVERSE}/pbp/play_by_play_${y}.csv.gz`,
  injuries: (y: number) => `${NFLVERSE}/injuries/injuries_${y}.csv`,
  schedule: 'https://github.com/nflverse/nfldata/raw/master/data/games.csv',
  ftn: (y: number) => `${NFLVERSE}/ftn_charting/ftn_charting_${y}.csv`,
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

type SleeperYear = { sleeperWeeks: Map<number, SleeperWeekStat[]>; projections: Map<number, StatMap> };
const sleeperCache = new Map<number, Promise<SleeperYear>>();

/** One season's Sleeper weekly stat rows and projections, fetched once per run. */
function sleeperYear(client: SleeperClient, y: NflYear): Promise<SleeperYear> {
  let p = sleeperCache.get(y.year);
  if (!p) {
    p = (async () => {
      const sleeperWeeks = new Map<number, SleeperWeekStat[]>();
      const projections = new Map<number, StatMap>();
      for (let week = 1; week <= y.throughWeek; week++) {
        const [rows, proj] = await Promise.all([client.getWeekStats(y.season, week), client.getProjections(y.season, week)]);
        if (!rows || rows.length === 0) {
          if (y.complete) throw new Error(`${y.year} week ${week}: Sleeper weekly rows ${rows ? 'empty' : 'missing'} for a finished season`);
          log(`WARNING: ${y.year} week ${week}: Sleeper weekly rows missing`);
          continue;
        }
        sleeperWeeks.set(week, rows);
        if (proj) projections.set(week, proj);
      }
      return { sleeperWeeks, projections };
    })();
    sleeperCache.set(y.year, p);
  }
  return p;
}

async function buildSeason(client: SleeperClient, y: NflYear, directory: PlayerDbInput['directory'], shared: Shared): Promise<ReturnType<typeof buildPlayerDb>> {
  const { year, complete, throughWeek } = y;
  log(`${year}: ${complete ? 'finished' : `in season, through week ${throughWeek}`}`);

  const { sleeperWeeks } = await sleeperYear(client, y);

  const snaps = rowsOf(await optionalText(URLS.snaps(year), year, 'snap counts'));
  const crosswalk = buildCrosswalk(shared.crosswalkIds, shared.nflPlayers, snaps);
  const weekly = rowsOf(await requireText(URLS.weekly(year), `${year} weekly stats`));
  const teamAirYards = nflverseTeamAirYards(weekly);
  const byGsis = mergeMaps(
    nflverseWeekly(weekly),
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
    year, throughWeek, builtAt: new Date().toISOString(), positionOverrides,
    sleeperWeeks, directory, crosswalk, byGsis, byPfr, nflPlayers: nflPlayerMeta(shared.nflPlayers), participation, teamAirYards, teamSnaps: snapCountTeamSnaps(snaps),
  });
  const unmapped = Object.values(db.players).filter((p) => !p.gsisId).length;
  log(`  ${db.rows.length} rows, ${Object.keys(db.players).length} players (${unmapped} without a gsis id)`);
  SharedPlayerDbSchema.parse(db);
  return db;
}

/** Why a finished season's existing file is not final (null when it is): it must parse, have real routes and reach week 18. */
function finishedFileProblem(file: string): string | null {
  if (!existsSync(file)) return 'no file yet';
  let db: ReturnType<typeof SharedPlayerDbSchema.parse>;
  try { db = SharedPlayerDbSchema.parse(JSON.parse(readFileSync(file, 'utf8'))); } catch { return 'the existing file does not parse'; }
  if (db.routesReal !== true) return 'the existing file has estimated routes, not real ones';
  if (!db.rows.some((r) => r.week === 18)) return 'the existing file has no week 18 rows';
  return null;
}

const LEAGUES_DIR = path.join(ROOT, 'data', 'leagues');

/** Phase 4: each league's points, projections and xFP for every season it played that has a shared playerdb file. */
async function pointsPhase(client: SleeperClient, chains: Map<string, SleeperLeague[]>, years: NflYear[]): Promise<string[]> {
  const outRoot = dryRun ? await mkdtemp(path.join(os.tmpdir(), 'fantasy-dash-points-')) : LEAGUES_DIR;
  const { failed } = await runPerLeague(configured.filter((c) => chains.has(c.slug)), async (cfg) => {
    let seasonFailed = false;
    for (const league of chains.get(cfg.slug)!) {
      const y = years.find((x) => x.year === Number(league.season));
      if (!y || (onlySeason !== null && y.year !== onlySeason)) continue;
      try {
        const dbFile = path.join(OUT_DIR, `${y.year}.json`);
        if (!existsSync(dbFile)) { log(`${cfg.slug} ${y.year}: no shared playerdb yet; no points`); continue; }
        const shared = SharedPlayerDbSchema.parse(JSON.parse(readFileSync(dbFile, 'utf8')));
        const file = path.join(LEAGUES_DIR, cfg.slug, 'points', `${y.year}.json`);
        const existing = existsSync(file) ? (() => { try { return JSON.parse(readFileSync(file, 'utf8')) as unknown; } catch { return undefined; } })() : undefined;
        if (y.complete && !full && pointsUpToDate(existing, { leagueId: league.league_id, dbBuiltAt: shared.builtAt })) { log(`${cfg.slug} ${y.year}: points up to date`); continue; }
        const { sleeperWeeks, projections } = await sleeperYear(client, y);
        const points = LeaguePointsSchema.parse(buildLeaguePoints({ shared, leagueId: league.league_id, builtAt: new Date().toISOString(), scoring: league.scoring_settings, sleeperWeeks, projections }));
        const dir = path.join(outRoot, cfg.slug, 'points');
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, `${y.year}.json`), JSON.stringify(points));
        log(`${cfg.slug} ${y.year}: points for ${Object.keys(points.players).length} players`);
      } catch (err) {
        seasonFailed = true;
        log(`✗ ${cfg.slug} ${y.year}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (seasonFailed) throw new Error('one or more seasons failed');
  }, log);
  if (dryRun) log(`Dry run: points in ${outRoot}`);
  if (failed.length) log(`points failed for: ${failed.join(', ')}`);
  return failed;
}

async function main() {
  const client = new SleeperClient();
  const chains = new Map<string, SleeperLeague[]>();
  const { failed } = await runPerLeague(configured, async (cfg) => { chains.set(cfg.slug, await walkLeagueChain(client, cfg.leagueId)); }, log);
  if (chains.size === 0) throw new Error(`no league could be read: ${failed.join(', ')}`);
  const all = nflYears([...chains.values()]);
  if (onlySeason !== null && !(Number.isInteger(onlySeason) && all.some((y) => y.year === onlySeason))) {
    throw new Error(`--season must name a league season (have: ${all.map((y) => y.year).join(', ')})`);
  }
  const years = all.filter((y) => onlySeason === null || y.year === onlySeason);
  log(`Seasons: ${years.map((y) => y.year).join(', ')}`);

  const failedLeagues = new Set(failed);
  if (!chartsOnly) {
    await playerDbPhase(client, years);
    // points right after the shared files, so a later phase failing cannot leave them stale beside new shared data
    for (const slug of await pointsPhase(client, chains, years)) failedLeagues.add(slug);
  }
  await chartsPhase(years);
  await schedulePhase(years);
  if (failedLeagues.size) {
    log(`leagues that failed: ${[...failedLeagues].join(', ')}`);
    process.exitCode = 1;
  }
}

/** Phase 3: each season's NFL regular-season schedule, for upcoming matchups. A failed download keeps the old files. */
async function schedulePhase(years: NflYear[]) {
  let csv: string | null;
  try { csv = await fetchText(URLS.schedule); } catch (err) { log(`schedule download failed, keeping old files: ${String(err)}`); return; }
  if (csv === null) { log('no schedule file; keeping old files'); return; }
  const rows = rowsOf(csv);
  const dir = dryRun ? await mkdtemp(path.join(os.tmpdir(), 'fantasy-dash-schedule-')) : SCHEDULE_DIR;
  await mkdir(dir, { recursive: true });
  for (const { year } of years) {
    const schedule = ScheduleSchema.parse(parseSchedule(rows, year));
    if (schedule.games.length === 0) { log(`${year}: no schedule games`); continue; }
    await writeFile(path.join(dir, `${year}.json`), JSON.stringify(schedule));
    log(`${year}: schedule, ${schedule.games.length} games`);
  }
  if (dryRun) log(`Dry run: schedules in ${dir}`);
}

/** Phase 1: the player database. */
async function playerDbPhase(client: SleeperClient, years: NflYear[]) {
  const todo = years.filter((y) => {
    if (!y.complete) return true;
    if (full) return true;
    const why = finishedFileProblem(path.join(OUT_DIR, `${y.year}.json`));
    if (why === null) { log(`${y.year}: finished and already built, skipping (pass --full to rebuild)`); return false; }
    log(`${y.year}: finished but ${why}; rebuilding`);
    return true;
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
  for (const y of todo) {
    if (y.throughWeek < 1) { log(`${y.year}: skipping, no scored weeks yet`); continue; }
    const db = await buildSeason(client, y, directory, shared);
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

/** A chart file is final when it parses and was built with participation; anything else is rebuilt (participation arrives after a season ends). */
function chartFileFinal(file: string): boolean {
  if (!existsSync(file)) return false;
  // a file built before the FTN join has no ftn flag: rebuild it once
  try { const db = ChartDbSchema.parse(JSON.parse(readFileSync(file, 'utf8'))); return db.participation && db.ftn !== undefined; } catch { return false; }
}

/** gsis → position: the season's player database first (league overrides apply), then the nflverse player list. */
function positionsFor(year: number, nflPlayers: Record<string, string>[]): (gsis: string) => DbPos | null {
  const m = new Map<string, DbPos>();
  for (const r of nflPlayers) if (r.gsis_id && isDbPos(r.position)) m.set(r.gsis_id, r.position);
  const file = path.join(OUT_DIR, `${year}.json`);
  if (existsSync(file)) for (const p of Object.values(SharedPlayerDbSchema.parse(JSON.parse(readFileSync(file, 'utf8'))).players)) if (p.gsisId) m.set(p.gsisId, p.pos);
  return (g) => m.get(g) ?? null;
}

/** Phase 2: play-by-play charts. A season without a participation or play-by-play file yet is skipped, not an error. */
async function chartsPhase(years: NflYear[]) {
  const todo = years.filter((y) => {
    if (full || !y.complete) return true;
    if (chartFileFinal(path.join(CHART_DIR, `${y.year}.json`))) { log(`${y.year}: charts already built, skipping`); return false; }
    return true;
  });
  if (todo.length === 0) return;
  const staging = dryRun ? await mkdtemp(path.join(os.tmpdir(), 'fantasy-dash-charts-')) : path.join(ROOT, '.tmp', 'charts');
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: true });
  let nflPlayers: Record<string, string>[] | null = null;
  const built: string[] = [];
  for (const { year } of todo) {
    const pbp = await fetchText(URLS.pbp(year));
    if (pbp === null) { log(`${year}: no play-by-play file yet; no charts`); continue; }
    const part = await fetchText(URLS.participation(year));
    if (part === null) log(`${year}: no participation file yet; building play-by-play charts only`);
    const injuries = await fetchText(URLS.injuries(year));
    if (injuries === null) log(`${year}: no injury report file`);
    const ftn = await fetchText(URLS.ftn(year));
    if (ftn === null) log(`${year}: no FTN charting file`);
    nflPlayers ??= rowsOf(await requireText(URLS.players, 'nflverse player list'));
    const db = buildCharts(parseCsv(pbp), part ? parseCsv(part) : [], positionsFor(year, nflPlayers), year, new Date().toISOString(), injuries ? parseCsv(injuries) : [], ftn ? parseCsv(ftn) : []);
    ChartDbSchema.parse(db);
    log(`${year}: charts for ${Object.keys(db.players).length} players`);
    const file = path.join(staging, `${year}.json`);
    await writeFile(file, JSON.stringify(db));
    built.push(file);
  }
  if (dryRun) { log(`Dry run: charts in ${staging}`); return; }
  await mkdir(CHART_DIR, { recursive: true });
  for (const file of built) await rename(file, path.join(CHART_DIR, path.basename(file)));
  await rm(staging, { recursive: true, force: true });
  log(`Wrote ${built.length} chart file(s) to ${CHART_DIR}`);
}

main().catch((err) => {
  console.error('[sync:players] FAILED:', err);
  process.exit(1);
});
