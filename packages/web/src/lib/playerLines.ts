import type { PlayerDirectory, PlayerId, PlayerLine as CoreLine, PlayoffTag, Season, UserId } from '@fantasy-dash/core';

export type PosFilter = 'All' | 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'K' | 'DEF';
export const POS_FILTERS: readonly PosFilter[] = ['All', 'QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF'];
export function isPosFilter(v: string | null | undefined): v is PosFilter {
  return (POS_FILTERS as readonly string[]).includes(v ?? '');
}

/** One player on one roster in one played week. */
export interface PlayerLine {
  playerId: PlayerId;
  userId: UserId;
  year: number;
  week: number;
  gameId: string;
  matchupId: number;
  tag: PlayoffTag | null;
  started: boolean;
  points: number;
  yards: number;
  touchdowns: number;
  receptions: number;
  /** true when the line carries any recorded stat; the per-week games-played flag is not persisted */
  played: boolean;
  /** a quarterfinal, semifinal or the Final */
  postseason: boolean;
  /** consolation round 1 or the Toilet Bowl */
  consolation: boolean;
  /** from the player directory; '?' when unknown */
  position: string;
  targets: number;
  carries: number;
  passAttempts: number;
  rushYards: number;
  recYards: number;
  passYards: number;
  rushTd: number;
  recTd: number;
  passTd: number;
  /** the roster's result that week */
  result: 'W' | 'L' | 'T';
}

/** games on the path to the title; the third- and fifth-place games are placement games and count as neither */
export const POSTSEASON_TAGS: ReadonlySet<string> = new Set(['QF', 'SF', 'Final']);
/** games on the path to the Toilet Bowl; the seventh-place game is a placement game */
export const CONSOLATION_TAGS: ReadonlySet<string> = new Set(['Cons-R1', 'Toilet Bowl']);

const n = (stats: Record<string, number>, key: string) => stats[key] ?? 0;

export function flattenLines(seasons: Season[], players: PlayerDirectory): PlayerLine[] {
  const out: PlayerLine[] = [];
  for (const s of seasons) {
    for (const wk of s.weeks) {
      if (!wk.played) continue;
      for (const g of wk.games) {
        const postseason = g.tag !== null && POSTSEASON_TAGS.has(g.tag);
        const consolation = g.tag !== null && CONSOLATION_TAGS.has(g.tag);
        for (const sideOf of g.sides) {
          const other = g.sides[0] === sideOf ? g.sides[1] : g.sides[0];
          const result: PlayerLine['result'] = sideOf.points > other.points ? 'W' : sideOf.points < other.points ? 'L' : 'T';
          const push = (p: CoreLine, started: boolean) => {
            const st = p.stats ?? {};
            out.push({
              playerId: p.playerId, userId: sideOf.userId, year: s.year, week: wk.week, gameId: g.id, matchupId: g.matchupId,
              tag: g.tag, started, points: p.points,
              yards: n(st, 'pass_yd') + n(st, 'rush_yd') + n(st, 'rec_yd'),
              touchdowns: n(st, 'pass_td') + n(st, 'rush_td') + n(st, 'rec_td'),
              receptions: n(st, 'rec'),
              targets: n(st, 'rec_tgt'), carries: n(st, 'rush_att'), passAttempts: n(st, 'pass_att'),
              rushYards: n(st, 'rush_yd'), recYards: n(st, 'rec_yd'), passYards: n(st, 'pass_yd'),
              rushTd: n(st, 'rush_td'), recTd: n(st, 'rec_td'), passTd: n(st, 'pass_td'),
              played: Object.keys(st).length > 0,
              postseason,
              consolation,
              position: players[p.playerId]?.position ?? '?',
              result,
            });
          };
          for (const e of sideOf.starters) if (e.player) push(e.player, true);
          for (const b of sideOf.bench) push(b, false);
        }
      }
    }
  }
  return out;
}

const FLEX = new Set(['RB', 'WR', 'TE']);

export function filterLines(lines: PlayerLine[], pos: PosFilter): PlayerLine[] {
  if (pos === 'All') return lines;
  if (pos === 'FLEX') return lines.filter((l) => FLEX.has(l.position));
  return lines.filter((l) => l.position === pos);
}
