import type { SleeperWeekStat } from '../sleeper/types';
import type { TeamWeek } from './types';

export const teamWeekKey = (team: string, week: number): string => `${team}|${week}`;

/** One TeamWeek per team per week, summed from every player's Sleeper row (all positions). Sorted by week then team. */
export function teamWeeksOf(sleeperWeeks: Map<number, SleeperWeekStat[]>, passPlays: Map<string, number> | null): TeamWeek[] {
  const out: TeamWeek[] = [];
  for (const [week, rows] of [...sleeperWeeks.entries()].sort((a, b) => a[0] - b[0])) {
    const byTeam = new Map<string, TeamWeek>();
    for (const r of rows) {
      if (!r.team) continue;
      if (r.player?.position === 'TEAM' || r.player_id.startsWith('TEAM_')) continue; // Sleeper ships a synthetic per-team totals row that would double-count
      const s = r.stats ?? {};
      let tw = byTeam.get(r.team);
      if (!tw) {
        tw = { team: r.team, week, opp: r.opponent ?? '', offSnaps: 0, passAtt: 0, rushAtt: 0, dropbacks: 0, rzLooks: 0, airYds: 0, passPlays: passPlays?.get(teamWeekKey(r.team, week)) ?? null };
        byTeam.set(r.team, tw);
      }
      if (!tw.opp && r.opponent) tw.opp = r.opponent;
      tw.offSnaps = Math.max(tw.offSnaps, s.tm_off_snp ?? 0);
      tw.passAtt += s.pass_att ?? 0;
      tw.rushAtt += s.rush_att ?? 0;
      tw.dropbacks += (s.pass_att ?? 0) + (s.pass_sack ?? 0);
      tw.rzLooks += (s.rush_rz_att ?? 0) + (s.rec_rz_tgt ?? 0);
      tw.airYds += s.pass_air_yd ?? 0;
    }
    out.push(...[...byTeam.values()].sort((a, b) => (a.team < b.team ? -1 : 1)));
  }
  return out;
}
