/** nflverse / DynastyProcess team codes that differ from Sleeper's. */
export const TEAM_ALIASES: Readonly<Record<string, string>> = {
  LA: 'LAR', STL: 'LAR', SD: 'LAC', OAK: 'LV', LVR: 'LV', JAC: 'JAX', WSH: 'WAS',
  TBB: 'TB', GBP: 'GB', KCC: 'KC', NEP: 'NE', NOS: 'NO', SFO: 'SF',
};
export const normalizeTeam = (team: string): string => TEAM_ALIASES[team] ?? team;

const SUFFIX = /\s+(jr|sr|ii|iii|iv|v)$/;
/** Lower-case, no punctuation, no generational suffix, single spaces. */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[.'’"\-]/g, '').replace(/\s+/g, ' ').trim().replace(SUFFIX, '').trim();
}

export interface NameHint { name: string; pos: string; team: string | null }
export interface Crosswalk {
  gsisOf(sleeperId: string, hint: NameHint): string | null;
  pfrOf(sleeperId: string, hint: NameHint): string | null;
  /** ESPN's id, for the transparent headshots; the id file only */
  espnOf(sleeperId: string): string | null;
}

const present = (v: string | undefined): string | null => (v && v !== 'NA' ? v : null);

/** name|pos|team → id, and name|pos → id when unique (null when ambiguous). */
class NameIndex {
  private byTeam = new Map<string, string>();
  private byPos = new Map<string, string | null>();
  add(name: string, pos: string, team: string, id: string) {
    const n = normalizeName(name);
    this.byTeam.set(`${n}|${pos}|${normalizeTeam(team)}`, id);
    const k = `${n}|${pos}`;
    if (!this.byPos.has(k)) this.byPos.set(k, id);
    else if (this.byPos.get(k) !== id) this.byPos.set(k, null);
  }
  find(hint: NameHint): string | null {
    const n = normalizeName(hint.name);
    if (hint.team) {
      const hit = this.byTeam.get(`${n}|${hint.pos}|${normalizeTeam(hint.team)}`);
      if (hit) return hit;
    }
    return this.byPos.get(`${n}|${hint.pos}`) ?? null;
  }
}

export function buildCrosswalk(
  ids: Iterable<Record<string, string>>,
  nflPlayers: Iterable<Record<string, string>>,
  snaps: Iterable<Record<string, string>>,
): Crosswalk {
  const gsis = new Map<string, string>();
  const pfr = new Map<string, string>();
  const espn = new Map<string, string>();
  for (const r of ids) {
    const sid = present(r.sleeper_id);
    if (!sid) continue;
    const g = present(r.gsis_id); if (g) gsis.set(sid, g);
    const p = present(r.pfr_id); if (p) pfr.set(sid, p);
    const e = present(r.espn_id); if (e) espn.set(sid, e);
  }
  const gsisNames = new NameIndex();
  for (const r of nflPlayers) if (r.gsis_id && r.display_name) gsisNames.add(r.display_name, r.position ?? '', r.latest_team ?? '', r.gsis_id);
  const pfrNames = new NameIndex();
  for (const r of snaps) if (r.pfr_player_id && r.player) pfrNames.add(r.player, r.position ?? '', r.team ?? '', r.pfr_player_id);
  return {
    gsisOf: (sid, hint) => gsis.get(sid) ?? gsisNames.find(hint),
    pfrOf: (sid, hint) => pfr.get(sid) ?? pfrNames.find(hint),
    espnOf: (sid) => espn.get(sid) ?? null,
  };
}
