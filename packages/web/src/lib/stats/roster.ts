import type { PlayerDirectory, PlayerId, Season, UserId } from '@fantasy-dash/core';
import { ownership, type Acquisition } from './ownership';

export interface DraftReturnCell { round: number; playerId: PlayerId | null; points: number }
export interface DraftReturnRow { id: UserId; total: number; cells: DraftReturnCell[] }
export interface DraftReturns { rounds: number; rows: DraftReturnRow[] }
export interface OriginRow { id: UserId; draft: number; pickup: number; trade: number; other: number; total: number }
export interface AgeRow { id: UserId; age: number; points: number; rookieShare: number; vetShare: number; estimated: boolean }
export interface RosterAge { rows: AgeRow[]; estimated: boolean }
export interface WireRow { id: UserId; perWeek: number[]; total: number; faab: number }
export interface WireActivity { weeks: number[]; rows: WireRow[] }

/** one started line: who started him, when, for how much, and how he was acquired */
interface Start { id: UserId; year: number; week: number; playerId: PlayerId; points: number; acq: Acquisition | null }

const round2 = (n: number) => Math.round(n * 100) / 100;
const idsOf = (season: Season): UserId[] => season.standings.map((r) => r.userId);
const byId = (x: { id: string }, y: { id: string }) => (x.id < y.id ? -1 : 1);

function starts(season: Season): Start[] {
  const own = ownership(season);
  const out: Start[] = [];
  for (const wk of season.weeks) {
    if (!wk.played) continue;
    for (const g of wk.games) for (const sd of g.sides) for (const e of sd.starters) {
      if (!e.player) continue;
      out.push({ id: sd.userId, year: season.year, week: wk.week, playerId: e.player.playerId, points: e.player.points, acq: own(e.player.playerId, sd.userId, wk.week) });
    }
  }
  return out;
}

/** started points the drafter got from each round's pick */
export function draftReturns(season: Season): DraftReturns | null {
  const draft = season.draft;
  if (!draft) return null;
  const all = starts(season);
  const rows = idsOf(season).map((id): DraftReturnRow => {
    const cells: DraftReturnCell[] = [];
    for (let round = 1; round <= draft.rounds; round++) {
      const pick = draft.picks.find((p) => p.userId === id && p.round === round);
      cells.push({ round, playerId: pick?.playerId ?? null, points: 0 });
    }
    for (const s of all) if (s.id === id && s.acq?.kind === 'draft') { const cell = cells[s.acq.round - 1]; if (cell) cell.points = round2(cell.points + s.points); }
    return { id, cells, total: round2(cells.reduce((t, c) => t + c.points, 0)) };
  });
  return { rounds: draft.rounds, rows: rows.sort((x, y) => y.total - x.total || byId(x, y)) };
}

/** started points by how the player arrived: draft, waivers and free agents, trades, or nobody knows (no log) */
export function pointOrigins(seasons: Season[]): OriginRow[] {
  const rows = new Map<UserId, OriginRow>();
  for (const season of seasons) for (const s of starts(season)) {
    const r = rows.get(s.id) ?? { id: s.id, draft: 0, pickup: 0, trade: 0, other: 0, total: 0 };
    const k = !s.acq ? 'other' : s.acq.kind === 'draft' ? 'draft' : s.acq.kind === 'trade' ? 'trade' : s.acq.kind === 'commissioner' ? 'other' : 'pickup';
    r[k] = round2(r[k] + s.points);
    r.total = round2(r.total + s.points);
    rows.set(s.id, r);
  }
  const share = (r: OriginRow) => (r.total ? (r.total - r.draft) / r.total : 0);
  return [...rows.values()].sort((x, y) => share(y) - share(x) || byId(x, y));
}

/** age on 1 September of the year, from the birth date; else 22 plus NFL seasons (estimated); else null */
export function ageOf(player: PlayerDirectory[string] | undefined, year: number): { age: number; estimated: boolean } | null {
  if (!player) return null;
  if (player.birthDate) {
    const [by, bm, bd] = player.birthDate.split('-').map(Number);
    const before = bm > 9 || (bm === 9 && bd > 1);
    return { age: year - by - (before ? 1 : 0), estimated: false };
  }
  if (player.yearsExp !== null && player.yearsExp !== undefined) return { age: 22 + player.yearsExp, estimated: true };
  return null;
}

/** average age behind each manager's started points, weighted by those points */
export function rosterAge(seasons: Season[], players: PlayerDirectory): RosterAge {
  const acc = new Map<UserId, { weighted: number; points: number; rookie: number; vet: number; estimated: boolean }>();
  for (const season of seasons) for (const s of starts(season)) {
    if (s.points <= 0) continue;
    const a = ageOf(players[s.playerId], season.year);
    if (!a) continue;
    const r = acc.get(s.id) ?? { weighted: 0, points: 0, rookie: 0, vet: 0, estimated: false };
    r.weighted += a.age * s.points;
    r.points += s.points;
    if (players[s.playerId]?.yearsExp === 0) r.rookie += s.points;
    if (a.age >= 30) r.vet += s.points;
    r.estimated = r.estimated || a.estimated;
    acc.set(s.id, r);
  }
  const rows = [...acc].filter(([, r]) => r.points > 0).map(([id, r]): AgeRow => ({ id, age: round2(r.weighted / r.points), points: round2(r.points), rookieShare: r.rookie / r.points, vetShare: r.vet / r.points, estimated: r.estimated }));
  return { rows: rows.sort((x, y) => x.age - y.age || byId(x, y)), estimated: rows.some((r) => r.estimated) };
}

/** waiver and free-agent pickups per played week, with the season's total and FAAB spent */
export function wireActivity(season: Season): WireActivity {
  const weeks = season.weeks.filter((w) => w.played).map((w) => w.week);
  const rows = idsOf(season).map((id): WireRow => ({ id, perWeek: weeks.map(() => 0), total: 0, faab: 0 }));
  const byUser = new Map(rows.map((r) => [r.id, r]));
  for (const t of season.transactions) {
    if (t.type !== 'waiver' && t.type !== 'free_agent') continue;
    for (const a of t.adds) {
      const r = byUser.get(a.userId);
      if (!r) continue;
      const i = weeks.indexOf(t.week);
      if (i >= 0) r.perWeek[i] += 1;
      r.total += 1;
      if (t.type === 'waiver' && t.bid) r.faab += t.bid;
    }
  }
  return { weeks, rows: rows.sort((x, y) => y.total - x.total || byId(x, y)) };
}
