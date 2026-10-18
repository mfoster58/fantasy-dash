import type { PlayerDb, PlayerDirectory, PlayerId } from '@fantasy-dash/core';

export interface Bio { name: string; pos: string; nflTeam: string; age: number | null; height: string | null; weight: number | null; college: string | null; nflDraft: string | null }

const ageOn = (birth: string, today: Date): number => {
  const b = new Date(`${birth}T00:00:00Z`);
  let age = today.getUTCFullYear() - b.getUTCFullYear();
  const m = today.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
};

/** Who he is: the newest player-database entry first, the league's player directory as the fallback. */
export function bioOf(id: PlayerId, players: PlayerDirectory, dbs: PlayerDb[], today: Date): Bio {
  const entry = [...dbs].sort((a, b) => b.year - a.year).map((d) => d.players[id]).find(Boolean);
  const dir = players[id];
  const birth = entry?.birthDate ?? dir?.birthDate ?? null;
  return {
    name: entry?.name ?? dir?.name ?? id,
    pos: entry?.pos ?? dir?.position ?? '?',
    nflTeam: dir?.team ?? entry?.teams.at(-1) ?? '',
    age: birth ? ageOn(birth, today) : null,
    height: entry?.height ? `${Math.floor(entry.height / 12)}'${entry.height % 12}"` : null,
    weight: entry?.weight ?? null,
    college: entry?.college ?? null,
    nflDraft: entry?.draft ? `${entry.draft.year} · R${entry.draft.round} #${entry.draft.pick}` : null,
  };
}
