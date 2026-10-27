import type { DbPos } from '../playerdb/types';
import { ROUTES, type Band, type GradeKey, type GradeSums, type TargetFilter, type PlayCounts, type RzKey, type ChartDb, type ChartPlayer, type Counts, type Lane, type Route, type Split, type Zone } from './types';

type Row = Record<string, string>;
const present = (v: string | undefined): v is string => v !== undefined && v !== '' && v !== 'NA';
const num = (v: string | undefined): number => { const x = Number(v); return present(v) && Number.isFinite(x) ? x : 0; };
const playKey = (game: string | undefined, play: string | undefined) => `${game ?? ''}|${Math.trunc(Number(play))}`;
const ROUTE_SET = new Set<string>(ROUTES);

/** The run lane from nflverse run_location and run_gap; null when either is missing. */
export function laneOf(location: string, gap: string): Lane | null {
  if (location === 'middle') return 'MID';
  if (location !== 'left' && location !== 'right') return null;
  const g = ({ end: 'E', tackle: 'T', guard: 'G' } as Record<string, string>)[gap];
  return g ? (`${location === 'left' ? 'L' : 'R'}${g}` as Lane) : null;
}

/** The passing zone from air yards and pass_location; null when either is missing. */
export function zoneOf(airYards: string, location: string): Zone | null {
  if (!present(airYards) || !['left', 'middle', 'right'].includes(location)) return null;
  const ay = Number(airYards);
  const band: Band = ay < 0 ? 'blos' : ay < 10 ? 'short' : ay < 20 ? 'mid' : 'deep';
  return `${band}|${location}` as Zone;
}

/** carry success under the yards-to-go rule: 40% of the distance on 1st down, 60% on 2nd, all of it on 3rd or 4th */
export function rushSuccess(down: number, toGo: number, gained: number): boolean {
  if (down === 1) return gained >= 0.4 * toGo;
  if (down === 2) return gained >= 0.6 * toGo;
  return gained >= toGo;
}
const rzBand = (yl: number): 'a' | 'b' | 'c' | null => (yl >= 1 && yl <= 5 ? 'a' : yl >= 6 && yl <= 10 ? 'b' : yl >= 11 && yl <= 20 ? 'c' : null);

/** The weekly injury report, regular season: gsis → week → [status, injury]; IR counts as Out. */
export function parseInjuries(rows: Iterable<Row>): ChartDb['injuries'] {
  const out: ChartDb['injuries'] = {};
  for (const r of rows) {
    // older files have only game_type
    if ((r.season_type ?? r.game_type) !== 'REG' || !present(r.gsis_id) || !present(r.week)) continue;
    const status = r.report_status === 'Injured Reserve' ? 'Out' : present(r.report_status) ? r.report_status : '';
    (out[r.gsis_id] ??= {})[String(Number(r.week))] = [status, (present(r.report_primary_injury) ? r.report_primary_injury : present(r.practice_primary_injury) ? r.practice_primary_injury : '')];
  }
  return out;
}

function bump<K extends string>(table: Partial<Record<K, Counts>>, key: K, values: number[]) {
  const c = (table[key] ??= values.map(() => 0));
  values.forEach((v, i) => { c[i] += v; });
}

const round = (v: number, places: number) => { const f = 10 ** places; const r = Math.round(v * f) / f; return r === 0 ? 0 : r; };
/** yards and counts to integers, epa to 2 places, cpoe sums to 1 place */
function roundAll(p: ChartPlayer) {
  const fix = (t: Partial<Record<string, Counts>>, epaAt: number, extra: Record<number, number> = {}) => {
    for (const c of Object.values(t)) if (c) c.forEach((v, i) => { c[i] = round(v, i === epaAt ? 2 : extra[i] ?? 0); });
  };
  if (p.routes) for (const t of Object.values(p.routes)) fix(t, 3);
  if (p.lanes) for (const t of Object.values(p.lanes)) fix(t, 2);
  if (p.zones) for (const t of Object.values(p.zones)) fix(t, 3, { 6: 1 });
  if (p.splits) fix(p.splits, 4);
  if (p.throws) for (const t of Object.values(p.throws)) fix(t, 3);
  const fixPlays = (c: PlayCounts) => {
    if (c.rush) c.rush = c.rush.map((v) => round(v, 0));
    if (c.rz) for (const x of Object.values(c.rz)) if (x) x.forEach((v, i) => { x[i] = round(v, i === 1 ? 1 : 0); });
    if (c.qtr) c.qtr = c.qtr.map((v, i) => round(v, i % 2 ? 2 : 0));
  };
  if (p.plays) { fixPlays(p.plays); for (const w of Object.values(p.plays.weeks ?? {})) fixPlays(w); }
  if (p.targets) for (const t of Object.values(p.targets)) if (t) fix(t, 3);
  if (p.grades) for (const [k, v] of Object.entries(p.grades)) p.grades[k as GradeKey] = round(v ?? 0, /epa/i.test(k) ? 2 : 1);
}

const yes = (v: string | undefined) => v === 'TRUE';
type Credit = (gsis: string, allowed: DbPos[]) => ChartPlayer | null;

/** One play's contribution to the grade sums, target maps and team totals. Two-point tries never reach here. */
function gradePlay(p: Row, f: Row | undefined, player: Credit, teams: Map<string, { rzTgt: number; in10: number }>, games: Map<ChartPlayer, Set<string>>) {
  const add = (g: GradeSums, k: GradeKey, v = 1) => { g[k] = (g[k] ?? 0) + v; };
  const team = `${p.game_id}|${p.posteam}`;
  const t = teams.get(team) ?? { rzTgt: 0, in10: 0 };
  teams.set(team, t);
  const played = (pl: ChartPlayer) => { let s = games.get(pl); if (!s) games.set(pl, (s = new Set())); s.add(team); };
  const yl = num(p.yardline_100), epa = num(p.epa), td = p.touchdown === '1' && (!present(p.td_team) || p.td_team === p.posteam);
  const moved = p.first_down === '1' || td;

  if (p.pass_attempt === '1' && p.sack !== '1' && present(p.receiver_player_id)) {
    if (yl >= 1 && yl <= 20) t.rzTgt++;
    const pl = player(p.receiver_player_id, ['WR', 'TE', 'RB']);
    if (pl) {
      played(pl);
      const g = (pl.grades ??= {}), comp = p.complete_pass === '1', yds = num(p.receiving_yards), ay = num(p.air_yards);
      add(g, 'tgt'); add(g, 'yds', yds); add(g, 'epa', epa);
      if (comp) add(g, 'rec');
      if (p.success === '1') add(g, 'succ');
      if (comp && moved) add(g, 'fd');
      if (p.pass_touchdown === '1') add(g, 'td');
      if (present(p.cp)) { add(g, 'cpN'); add(g, 'cpSum', num(p.cp)); if (comp) add(g, 'cpRec'); }
      if (comp && present(p.xyac_mean_yardage)) { add(g, 'yacN'); add(g, 'yacOe', num(p.yards_after_catch) - num(p.xyac_mean_yardage)); }
      if (present(p.air_yards) && ay >= 20) { add(g, 'deep'); add(g, 'deepYds', yds); add(g, 'deepEpa', epa); if (comp) add(g, 'deepRec'); }
      if (p.down === '3') { add(g, 't3'); if (moved) add(g, 't3Conv'); }
      if (yl >= 1 && yl <= 20) add(g, 'rzTgt');
      if (present(p.air_yards) && yl > 0 && ay >= yl) add(g, 'ezTgt');
      if (f) {
        add(g, 'ftnTgt');
        if (yes(f.is_catchable_ball)) add(g, 'catchable');
        if (yes(f.is_drop)) add(g, 'drops');
        if (yes(f.is_contested_ball)) { add(g, 'contested'); if (comp) add(g, 'contestedRec'); }
        if (yes(f.is_created_reception)) add(g, 'created');
        if (yes(f.is_motion)) add(g, 'motionTgt');
        if (yes(f.is_play_action)) add(g, 'paTgt');
        if (yes(f.is_screen_pass)) add(g, 'screenTgt');
      }
      const zone = zoneOf(p.air_yards ?? '', p.pass_location ?? '');
      if (zone) {
        const v = [1, comp ? 1 : 0, yds, epa, num(p.pass_touchdown)];
        const keys: TargetFilter[] = ['all'];
        if (f) {
          keys.push(yes(f.is_play_action) ? 'pa' : 'nopa');
          if (yes(f.is_motion)) keys.push('motion');
          if (yes(f.is_screen_pass)) keys.push('screen');
          if (num(f.n_blitzers) > 0) keys.push('blitz');
          if (yes(f.is_contested_ball)) keys.push('contested');
        }
        const tm = (pl.targets ??= {});
        for (const k of keys) bump((tm[k] ??= {}), zone, v);
      }
    }
  }

  if (p.qb_dropback === '1' && present(p.passer_player_id)) {
    const pl = player(p.passer_player_id, ['QB']);
    if (pl) {
      played(pl);
      const g = (pl.grades ??= {}), sack = p.sack === '1', att = p.pass_attempt === '1' && !sack, comp = p.complete_pass === '1';
      add(g, 'db'); add(g, 'dbEpa', epa);
      if (p.success === '1') add(g, 'dbSucc');
      if (sack) { add(g, 'sacks'); add(g, 'sackYds', -num(p.yards_gained)); }
      if (att) {
        add(g, 'att'); add(g, 'passYds', num(p.passing_yards));
        if (p.pass_touchdown === '1') add(g, 'passTd');
        if (p.interception === '1') add(g, 'int');
        if (present(p.air_yards) && num(p.air_yards) >= 20) {
          add(g, 'deepAtt'); add(g, 'deepAttEpa', epa);
          if (comp) add(g, 'deepCmp');
          if (present(p.cpoe)) { add(g, 'deepCpoeN'); add(g, 'deepCpoeSum', num(p.cpoe)); }
        }
      }
      if (p.down === '3') { add(g, 't3Db'); if (moved) add(g, 't3DbConv'); }
      if (yl >= 1 && yl <= 20) { add(g, 'rzDb'); if (td) add(g, 'rzTd'); }
      if (num(p.qtr) >= 4) { add(g, 'q4Db'); add(g, 'q4Epa', epa); }
      if (num(p.score_differential) < 0) { add(g, 'trailDb'); add(g, 'trailEpa', epa); }
      if (f) {
        add(g, 'ftnDb');
        if (att) {
          add(g, 'ftnAtt');
          if (yes(f.is_interception_worthy)) add(g, 'iw');
          if (yes(f.is_throw_away)) add(g, 'throwaway');
          if (yes(f.is_catchable_ball)) add(g, 'catchableThrown');
          if (yes(f.is_drop)) add(g, 'recDrops');
          if (num(f.read_thrown) > 0) { add(g, 'readN'); if (num(f.read_thrown) === 1) add(g, 'firstRead'); }
        }
        if (yes(f.is_qb_fault_sack)) add(g, 'faultSack');
        if (yes(f.is_play_action)) { add(g, 'paDb'); add(g, 'paEpa', epa); }
        if (num(f.n_blitzers) > 0) { add(g, 'blitzDb'); add(g, 'blitzEpa', epa); } else { add(g, 'noBlitzDb'); add(g, 'noBlitzEpa', epa); }
      }
    }
  }

  if (p.rush_attempt === '1' && present(p.rusher_player_id)) {
    const scramble = p.qb_scramble === '1';
    if (!scramble && yl >= 1 && yl <= 10) t.in10++;
    const qb = player(p.rusher_player_id, ['QB']);
    if (qb) {
      played(qb);
      const g = (qb.grades ??= {});
      if (scramble) { add(g, 'scr'); add(g, 'scrYds', num(p.yards_gained)); } else { add(g, 'drun'); add(g, 'drunEpa', epa); }
      if (moved) add(g, 'rushFd');
    }
    const pl = scramble ? null : player(p.rusher_player_id, ['RB']);
    if (pl) {
      played(pl);
      const g = (pl.grades ??= {}), yds = num(p.yards_gained);
      add(g, 'car'); add(g, 'carYds', yds); add(g, 'carEpa', epa);
      if (p.success === '1') add(g, 'carSucc');
      if (moved) add(g, 'carFd');
      if (yds >= 10) add(g, 'explosive');
      if (yds <= 0) add(g, 'stuffed');
      if (yl >= 1 && yl <= 10) add(g, 'in10');
      if (yl >= 1 && yl <= 5) { add(g, 'in5'); if (p.rush_touchdown === '1') add(g, 'in5Td'); }
      if ((p.run_location === 'left' || p.run_location === 'right') && p.run_gap === 'end') add(g, 'outside');
      if (f) {
        add(g, 'ftnCar');
        const box = num(f.n_defense_box);
        if (box > 0) {
          add(g, 'boxN'); add(g, 'boxSum', box);
          if (box <= 6) { add(g, 'lightCar'); add(g, 'lightYds', yds); }
          if (box >= 8) { add(g, 'heavyCar'); add(g, 'heavyYds', yds); }
        }
        if (yes(f.is_rpo)) add(g, 'rpo');
      }
    }
  }
}

/**
 * Play-by-play joined to participation (on game and play), as per-player chart counts.
 * Routes for WR/TE/RB targets with a route; lanes for RB carries (not scrambles); zones and splits for QB dropbacks.
 * Blank participation fields leave a play out of that filter but keep it in `all`.
 */
export function buildCharts(pbp: Iterable<Row>, participation: Iterable<Row>, posOf: (gsis: string) => DbPos | null, year: number, builtAt: string, injuries: Iterable<Row> = [], ftn: Iterable<Row> = []): ChartDb {
  const parts = new Map<string, Row>();
  for (const r of participation) parts.set(playKey(r.nflverse_game_id, r.play_id), r);
  const charted = new Map<string, Row>();
  for (const r of ftn) charted.set(playKey(r.nflverse_game_id, r.nflverse_play_id), r);
  const hasPart = parts.size > 0;
  const players: Record<string, ChartPlayer> = {};
  const player = (gsis: string, allowed: DbPos[]): ChartPlayer | null => {
    const pos = players[gsis]?.pos ?? posOf(gsis);
    if (!pos || !allowed.includes(pos)) return null;
    return (players[gsis] ??= { pos });
  };

  const teams = new Map<string, { rzTgt: number; in10: number }>();
  const games = new Map<ChartPlayer, Set<string>>();

  for (const p of pbp) {
    const week = num(p.week);
    if (p.season_type !== 'REG' || week < 1 || week > 18) continue;
    const x = parts.get(playKey(p.game_id, p.play_id));
    const f = charted.get(playKey(p.game_id, p.play_id));
    if (p.two_point_attempt !== '1') gradePlay(p, f, player, teams, games);

    if (hasPart && present(p.receiver_player_id) && x && ROUTE_SET.has(x.route)) {
      const pl = player(p.receiver_player_id, ['WR', 'TE', 'RB']);
      if (pl) {
        const t = (pl.routes ??= { all: {}, man: {}, zone: {} });
        const v = [1, num(p.complete_pass), num(p.receiving_yards), num(p.epa), num(p.pass_touchdown)];
        const cov = x.defense_man_zone_type === 'MAN_COVERAGE' ? 'man' : x.defense_man_zone_type === 'ZONE_COVERAGE' ? 'zone' : null;
        bump(t.all, x.route as Route, v);
        if (cov) bump(t[cov], x.route as Route, v);
        const qb = present(p.passer_player_id) ? player(p.passer_player_id, ['QB']) : null;
        if (qb) {
          const q = (qb.throws ??= { all: {}, man: {}, zone: {} });
          bump(q.all, x.route as Route, v);
          if (cov) bump(q[cov], x.route as Route, v);
        }
      }
    }

    if (p.rush_attempt === '1' && p.qb_scramble !== '1' && present(p.rusher_player_id)) {
      const lane = laneOf(p.run_location ?? '', p.run_gap ?? '');
      const pl = lane ? player(p.rusher_player_id, ['RB']) : null;
      if (pl && lane) {
        const t = (pl.lanes ??= { all: {}, light: {}, heavy: {} });
        const v = [1, num(p.yards_gained), num(p.epa), num(p.epa) > 0 ? 1 : 0, num(p.rush_touchdown)];
        bump(t.all, lane, v);
        // participation's box count, else FTN's (0 there means not charted)
        const box = present(x?.defenders_in_box) ? Number(x.defenders_in_box) : num(f?.n_defense_box) > 0 ? num(f?.n_defense_box) : null;
        if (box !== null) bump(t[box <= 6 ? 'light' : 'heavy'], lane, v);
      }
    }

    if (p.pass_attempt === '1' && present(p.passer_player_id)) {
      const pl = player(p.passer_player_id, ['QB']);
      if (pl) {
        const sack = p.sack === '1';
        const pocket = x?.was_pressure === 'TRUE' ? 'pressured' : x?.was_pressure === 'FALSE' ? 'clean' : null;
        const keys: Split[] = ['all'];
        if (pocket) keys.push(pocket);
        if (present(x?.number_of_pass_rushers)) keys.push(Number(x.number_of_pass_rushers) >= 5 ? 'blitz' : 'noblitz');
        if (x?.defense_man_zone_type === 'MAN_COVERAGE') keys.push('man');
        if (x?.defense_man_zone_type === 'ZONE_COVERAGE') keys.push('zone');
        if (x && ['COVER_0', 'COVER_1', 'COVER_2', 'COVER_3', 'COVER_4', 'COVER_6'].includes(x.defense_coverage_type)) keys.push(x.defense_coverage_type as Split);
        if (present(x?.time_to_throw)) keys.push(Number(x.time_to_throw) < 2.5 ? 'quick' : 'hold');
        const sv = [1, sack ? 0 : 1, sack ? 0 : num(p.complete_pass), sack ? 0 : num(p.passing_yards), num(p.epa), sack ? 1 : 0];
        if (hasPart) for (const k of keys) bump((pl.splits ??= {}), k, sv);
        const zone = sack ? null : zoneOf(p.air_yards ?? '', p.pass_location ?? '');
        if (zone) {
          const z = (pl.zones ??= { all: {}, clean: {}, pressured: {} });
          const hasCpoe = present(p.cpoe);
          const zv = [1, num(p.complete_pass), num(p.passing_yards), num(p.epa), num(p.pass_touchdown), num(p.interception), hasCpoe ? num(p.cpoe) : 0, hasCpoe ? 1 : 0];
          bump(z.all, zone, zv);
          if (pocket) bump(z[pocket], zone, zv);
        }
      }
    }

    // play-by-play only: built with or without participation
    if (p.two_point_attempt !== '1') {
      // each count goes to the season and to its week
      const into = (pl: ChartPlayer, f: (c: PlayCounts) => void) => { const plays = (pl.plays ??= {}); f(plays); f(((plays.weeks ??= {})[String(week)] ??= {})); };
      if (p.rush_attempt === '1' && p.qb_scramble !== '1' && present(p.rusher_player_id)) {
        const pl = player(p.rusher_player_id, ['RB']);
        if (pl) {
          const gained = num(p.yards_gained);
          const b = rzBand(num(p.yardline_100));
          into(pl, (c) => {
            bump(c as Record<string, Counts>, 'rush', [1, rushSuccess(num(p.down), num(p.ydstogo), gained) ? 1 : 0, gained >= 10 ? 1 : 0, gained]);
            if (b) bump((c.rz ??= {}), `r${b}` as RzKey, [1, num(p.rushing_yards) * 0.1 + num(p.rush_touchdown) * 6]);
          });
        }
      }
      if (p.pass_attempt === '1' && p.sack !== '1' && present(p.receiver_player_id)) {
        const b = rzBand(num(p.yardline_100));
        const pl = b ? player(p.receiver_player_id, ['RB']) : null;
        if (pl && b) into(pl, (c) => bump((c.rz ??= {}), `t${b}` as RzKey, [1, num(p.complete_pass) + num(p.receiving_yards) * 0.1 + num(p.pass_touchdown) * 6]));
      }
      if (p.pass_attempt === '1' && present(p.passer_player_id)) {
        const pl = player(p.passer_player_id, ['QB']);
        if (pl) into(pl, (c) => bump(c as Record<string, Counts>, 'qtr', num(p.qtr) >= 4 ? [0, 0, 1, num(p.epa)] : [1, num(p.epa), 0, 0]));
      }
    }
  }
  // team red-zone targets and inside-10 carries over the games he played, for whichever team he played them for
  for (const [pl, set] of games) {
    const g = (pl.grades ??= {});
    for (const k of set) { const t = teams.get(k); if (t) { g.teamRzTgt = (g.teamRzTgt ?? 0) + t.rzTgt; g.teamIn10 = (g.teamIn10 ?? 0) + t.in10; } }
  }
  for (const p of Object.values(players)) roundAll(p);
  return { year, builtAt, participation: hasPart, ftn: charted.size > 0, injuries: parseInjuries(injuries), players };
}
