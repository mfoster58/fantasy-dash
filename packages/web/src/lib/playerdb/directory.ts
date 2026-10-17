import type { PlayerDb, PlayerDirectory } from '@fantasy-dash/core';

const cache = new WeakMap<PlayerDb, PlayerDirectory>();

/** The database's players as a PlayerDirectory, so Headshot, PosPill and the name helpers work for unrostered players too. */
export function dbDirectory(db: PlayerDb): PlayerDirectory {
  let d = cache.get(db);
  if (d) return d;
  d = {};
  for (const p of Object.values(db.players)) {
    const [firstName, ...rest] = p.name.split(' ');
    d[p.id] = { id: p.id, name: p.name, firstName, lastName: rest.join(' '), position: p.pos, team: p.teams[p.teams.length - 1] ?? null, yearsExp: p.yearsExp, birthDate: p.birthDate };
  }
  cache.set(db, d);
  return d;
}
