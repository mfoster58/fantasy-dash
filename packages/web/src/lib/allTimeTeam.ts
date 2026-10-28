import type { PlayerId, PlayoffTag, Season, UserId } from '@fantasy-dash/core';
import type { PlayerLine } from './playerLines';

export type Slot = 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'DEF' | 'K';
/** the lineup an all-time team fills, in display order */
export const SLOTS: readonly Slot[] = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'DEF', 'K'];
const FLEX = new Set(['RB', 'WR', 'TE']);
const round2 = (n: number) => Math.round(n * 100) / 100;

interface Candidate { playerId: PlayerId; position: string; points: number }
/** one player-season on this manager's roster: every week counted, started or not */
export interface SeasonPick extends Candidate { year: number; games: number; ppg: number; posRank: number | null }
/** one player-game this manager started, with that game's stat line */
export interface GamePick extends Candidate { year: number; week: number; matchupId: number; tag: PlayoffTag | null; stats: Record<string, number> }
export interface AllTimeTeam { season: { slot: Slot; pick: SeasonPick | null }[]; game: { slot: Slot; pick: GamePick | null }[] }

/** Fill the slots best-first; each player appears once, at their best, and FLEX takes the best RB/WR/TE left over. */
export function fillSlots<T extends Candidate>(candidates: T[]): { slot: Slot; pick: T | null }[] {
  const best = new Map<PlayerId, T>();
  for (const c of candidates) { const cur = best.get(c.playerId); if (!cur || c.points > cur.points) best.set(c.playerId, c); }
  const pool = [...best.values()].sort((a, b) => b.points - a.points || (a.playerId < b.playerId ? -1 : 1));
  const used = new Set<PlayerId>();
  return SLOTS.map((slot) => {
    const pick = pool.find((p) => !used.has(p.playerId) && (slot === 'FLEX' ? FLEX.has(p.position) : p.position === slot)) ?? null;
    if (pick) used.add(pick.playerId);
    return { slot, pick };
  });
}

/** The best season at every slot from everyone who has been on this manager's roster, and the best single game he started there (bench weeks never count). */
export function allTimeTeam(lines: PlayerLine[], userId: UserId, seasons: Season[]): AllTimeTeam {
  const mine = lines.filter((l) => l.userId === userId);
  const posRank = (year: number, id: PlayerId) => seasons.find((s) => s.year === year)?.playerSeasons[id]?.posRank ?? null;
  const bySeason = new Map<string, SeasonPick>();
  for (const l of mine) {
    const k = `${l.year}-${l.playerId}`;
    const p = bySeason.get(k) ?? { playerId: l.playerId, position: l.position, year: l.year, points: 0, games: 0, ppg: 0, posRank: posRank(l.year, l.playerId) };
    p.points = round2(p.points + l.points);
    if (l.played) p.games += 1;
    bySeason.set(k, p);
  }
  for (const p of bySeason.values()) p.ppg = p.games ? round2(p.points / p.games) : 0;
  // each started player's stat line, by season, week and player
  const stats = new Map<string, Record<string, number>>();
  for (const s of seasons) for (const w of s.weeks) for (const g of w.games) for (const side of g.sides) {
    if (side.userId !== userId) continue;
    for (const st of side.starters) if (st.player) stats.set(`${s.year}-${w.week}-${st.player.playerId}`, st.player.stats);
  }
  const games: GamePick[] = mine.filter((l) => l.started).map((l) => ({
    playerId: l.playerId, position: l.position, year: l.year, week: l.week, matchupId: l.matchupId, tag: l.tag, points: l.points,
    stats: stats.get(`${l.year}-${l.week}-${l.playerId}`) ?? {},
  }));
  return { season: fillSlots([...bySeason.values()]), game: fillSlots(games) };
}
