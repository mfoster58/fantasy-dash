import type { PlayerDirectory, PlayerId, PlayerInfo, Season } from './types';
import type { SleeperPlayer } from './sleeper/types';

export function toPlayerDirectory(raw: Record<string, SleeperPlayer>): PlayerDirectory {
  const dir: PlayerDirectory = {};
  for (const [id, p] of Object.entries(raw)) {
    const firstName = p.first_name ?? '';
    const lastName = p.last_name ?? '';
    const name = p.full_name ?? `${firstName} ${lastName}`.trim();
    const info: PlayerInfo = {
      id,
      name: name || id,
      firstName,
      lastName,
      position: p.position ?? null,
      team: p.team ?? null,
      yearsExp: typeof p.years_exp === 'number' ? p.years_exp : null,
    };
    dir[id] = info;
  }
  return dir;
}

export function trimPlayers(dir: PlayerDirectory, keep: Set<PlayerId>): PlayerDirectory {
  const out: PlayerDirectory = {};
  for (const id of keep) if (dir[id]) out[id] = dir[id];
  return out;
}

export function collectPlayerIds(seasons: Season[]): Set<PlayerId> {
  const ids = new Set<PlayerId>();
  for (const s of seasons) {
    for (const wk of s.weeks) {
      for (const g of wk.games) {
        for (const side of g.sides) {
          for (const e of side.starters) if (e.player) ids.add(e.player.playerId);
          for (const b of side.bench) ids.add(b.playerId);
          for (const sw of side.optimalSwaps) { ids.add(sw.in); if (sw.out) ids.add(sw.out); }
        }
      }
    }
  }
  return ids;
}
