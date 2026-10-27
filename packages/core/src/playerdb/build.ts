import type { SleeperPlayer, SleeperWeekStat, StatMap } from '../sleeper/types';
import type { Crosswalk } from './crosswalk';
import { routesEstimate } from './derive';
import { weekKey, type WeekFields } from './fields';
import type { Participation } from './sources/participation';
import type { PlayerMeta } from './sources/players';
import { positionOf, sleeperRow } from './sources/sleeper';
import { teamWeekKey, teamWeeksOf } from './teamWeeks';
import { fitXfpCoefficients, predictXfp } from './xfp';
import type { DbPlayer, DbPos, PlayerDb, PlayerWeek, PlayerWeekKey, TeamWeek } from './types';

export interface PlayerDbInput {
  year: number; throughWeek: number; builtAt: string;
  scoring: Record<string, number>;
  positionOverrides: Readonly<Record<string, string>>;
  /** week → every NFL player's Sleeper row */
  sleeperWeeks: Map<number, SleeperWeekStat[]>;
  /** week → Sleeper projection stat map */
  projections: Map<number, StatMap>;
  /** the Sleeper player directory, for names, positions, birth dates and experience */
  directory: Record<string, SleeperPlayer>;
  crosswalk: Crosswalk;
  /** `${gsis}|${week}` → fields from the nflverse weekly file and the three NGS files, already merged */
  byGsis: Map<string, WeekFields>;
  /** `${pfr}|${week}` → fields from the three PFR files and the snap counts, already merged */
  byPfr: Map<string, WeekFields>;
  nflPlayers: Map<string, PlayerMeta>;
  participation: Participation | null;
  /** `${team}|${week}` (Sleeper team codes) → intended passing air yards from nflverse; null falls back to Sleeper's sum */
  teamAirYards: Map<string, number> | null;
  /** `${team}|${week}` → offensive snaps derived from the snap-count file; fills team weeks where Sleeper has none */
  teamSnaps: Map<string, number> | null;
}

/** Copy `extra` fields the base row does not already have. Sleeper's numbers always win. */
export function mergeInto(base: PlayerWeek, extra: WeekFields | undefined): void {
  if (!extra) return;
  for (const [k, v] of Object.entries(extra) as [PlayerWeekKey, number][]) if (base[k] === undefined) base[k] = v;
}

const nameOf = (p: SleeperPlayer | undefined, raw: SleeperWeekStat): string => {
  const fromRow = `${raw.player?.first_name ?? ''} ${raw.player?.last_name ?? ''}`.trim();
  return p?.full_name ?? ((fromRow || `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim()) || raw.player_id);
};

export function buildPlayerDb(input: PlayerDbInput): PlayerDb {
  const { crosswalk, directory, participation } = input;
  const weeks = new Map([...input.sleeperWeeks].filter(([w]) => w >= 1 && w <= input.throughWeek));
  const teamWeeks = teamWeeksOf(weeks, participation?.passPlays ?? null, input.teamAirYards, input.teamSnaps);
  const teamWeekOf = new Map<string, TeamWeek>(teamWeeks.map((t) => [teamWeekKey(t.team, t.week), t]));
  const players: Record<string, DbPlayer> = {};
  const posOf = new Map<string, DbPos>();
  const rows: PlayerWeek[] = [];

  for (const [week, raws] of [...weeks.entries()].sort((a, b) => a[0] - b[0])) {
    const proj = input.projections.get(week) ?? {};
    for (const raw of [...raws].sort((a, b) => (a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : 0))) {
      const dir = directory[raw.player_id];
      const pos = positionOf(raw, dir?.position ?? null, input.positionOverrides);
      if (!pos) continue;
      const row = sleeperRow(raw, week, input.scoring, proj[raw.player_id]);
      if (!row) continue;
      const tw = teamWeekOf.get(teamWeekKey(row.team, week));
      if (tw && tw.offSnaps > 0) row.teamSnaps = tw.offSnaps;
      let p = players[raw.player_id];
      if (!p) {
        const hint = { name: nameOf(dir, raw), pos, team: raw.team };
        const gsisId = crosswalk.gsisOf(raw.player_id, hint);
        const meta = gsisId ? input.nflPlayers.get(gsisId) : undefined;
        p = {
          id: raw.player_id, gsisId, pfrId: crosswalk.pfrOf(raw.player_id, hint), espnId: crosswalk.espnOf(raw.player_id), name: hint.name, pos, teams: [],
          birthDate: meta?.birthDate ?? (/^\d{4}-\d{2}-\d{2}$/.test(dir?.birth_date ?? '') ? dir!.birth_date! : null),
          yearsExp: typeof dir?.years_exp === 'number' ? dir.years_exp : null,
          draft: meta?.draft ?? null, college: meta?.college ?? null, height: meta?.height ?? null, weight: meta?.weight ?? null,
        };
        players[raw.player_id] = p;
        posOf.set(raw.player_id, pos);
      }
      if (!p.teams.includes(row.team)) p.teams.push(row.team);
      if (p.gsisId) mergeInto(row, input.byGsis.get(weekKey(p.gsisId, week)));
      if (p.pfrId) mergeInto(row, input.byPfr.get(weekKey(p.pfrId, week)));
      if (participation) {
        if (p.gsisId && pos !== 'QB') { const r = participation.routes.get(weekKey(p.gsisId, week)); if (r !== undefined) row.routes = r; }
      } else if (pos !== 'QB') {
        const est = routesEstimate(row, tw);
        if (est !== null) row.routesEst = est;
      }
      rows.push(row);
    }
  }

  const xfp = fitXfpCoefficients(rows, (id) => posOf.get(id) ?? null);
  for (const r of rows) {
    const v = predictXfp(xfp[posOf.get(r.id)!], posOf.get(r.id)!, r);
    if (v !== null) r.xfp = v;
  }
  rows.sort((a, b) => a.week - b.week || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return { year: input.year, throughWeek: input.throughWeek, routesReal: participation !== null, builtAt: input.builtAt, players, teamWeeks, xfp, rows };
}
