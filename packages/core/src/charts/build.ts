import type { DbPos } from '../playerdb/types';
import { ROUTES, type Band, type ChartDb, type ChartPlayer, type Counts, type Lane, type Route, type Split, type Zone } from './types';

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
}

/**
 * Play-by-play joined to participation (on game and play), as per-player chart counts.
 * Routes for WR/TE/RB targets with a route; lanes for RB carries (not scrambles); zones and splits for QB dropbacks.
 * Blank participation fields leave a play out of that filter but keep it in `all`.
 */
export function buildCharts(pbp: Iterable<Row>, participation: Iterable<Row>, posOf: (gsis: string) => DbPos | null, year: number, builtAt: string): ChartDb {
  const parts = new Map<string, Row>();
  for (const r of participation) parts.set(playKey(r.nflverse_game_id, r.play_id), r);
  const players: Record<string, ChartPlayer> = {};
  const player = (gsis: string, allowed: DbPos[]): ChartPlayer | null => {
    const pos = players[gsis]?.pos ?? posOf(gsis);
    if (!pos || !allowed.includes(pos)) return null;
    return (players[gsis] ??= { pos });
  };

  for (const p of pbp) {
    const week = num(p.week);
    if (p.season_type !== 'REG' || week < 1 || week > 18) continue;
    const x = parts.get(playKey(p.game_id, p.play_id));

    if (present(p.receiver_player_id) && x && ROUTE_SET.has(x.route)) {
      const pl = player(p.receiver_player_id, ['WR', 'TE', 'RB']);
      if (pl) {
        const t = (pl.routes ??= { all: {}, man: {}, zone: {} });
        const v = [1, num(p.complete_pass), num(p.receiving_yards), num(p.epa), num(p.pass_touchdown)];
        const cov = x.defense_man_zone_type === 'MAN_COVERAGE' ? 'man' : x.defense_man_zone_type === 'ZONE_COVERAGE' ? 'zone' : null;
        bump(t.all, x.route as Route, v);
        if (cov) bump(t[cov], x.route as Route, v);
      }
    }

    if (p.rush_attempt === '1' && p.qb_scramble !== '1' && present(p.rusher_player_id)) {
      const lane = laneOf(p.run_location ?? '', p.run_gap ?? '');
      const pl = lane ? player(p.rusher_player_id, ['RB']) : null;
      if (pl && lane) {
        const t = (pl.lanes ??= { all: {}, light: {}, heavy: {} });
        const v = [1, num(p.yards_gained), num(p.epa), num(p.epa) > 0 ? 1 : 0, num(p.rush_touchdown)];
        bump(t.all, lane, v);
        if (present(x?.defenders_in_box)) bump(t[Number(x.defenders_in_box) <= 6 ? 'light' : 'heavy'], lane, v);
      }
    }

    if (p.pass_attempt === '1' && present(p.passer_player_id)) {
      const pl = player(p.passer_player_id, ['QB']);
      if (pl) {
        const sack = p.sack === '1';
        const pocket = x?.was_pressure === 'TRUE' ? 'pressured' : x?.was_pressure === 'FALSE' ? 'clean' : null;
        const s = (pl.splits ??= {});
        const keys: Split[] = ['all'];
        if (pocket) keys.push(pocket);
        if (present(x?.number_of_pass_rushers)) keys.push(Number(x.number_of_pass_rushers) >= 5 ? 'blitz' : 'noblitz');
        if (x?.defense_man_zone_type === 'MAN_COVERAGE') keys.push('man');
        if (x?.defense_man_zone_type === 'ZONE_COVERAGE') keys.push('zone');
        if (x && ['COVER_0', 'COVER_1', 'COVER_2', 'COVER_3', 'COVER_4', 'COVER_6'].includes(x.defense_coverage_type)) keys.push(x.defense_coverage_type as Split);
        if (present(x?.time_to_throw)) keys.push(Number(x.time_to_throw) < 2.5 ? 'quick' : 'hold');
        const sv = [1, sack ? 0 : 1, sack ? 0 : num(p.complete_pass), sack ? 0 : num(p.passing_yards), num(p.epa), sack ? 1 : 0];
        for (const k of keys) bump(s, k, sv);
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
  }
  for (const p of Object.values(players)) roundAll(p);
  return { year, builtAt, players };
}
