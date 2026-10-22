import type { PlayerDirectory, PlayerId, UserId, Week } from '@fantasy-dash/core';
import { playerName } from '../players';

export interface Hitter { kind: 'high' | 'blowout' | 'nail'; userId: UserId; loser: UserId | null; value: number; matchupId: number }

/** High score, blowout and nail-biter for a played week; ties to the lower matchup id. */
export function weekHitters(week: Week): Hitter[] {
  const games = [...week.games].sort((x, y) => x.matchupId - y.matchupId);
  const out: Hitter[] = [];
  let high: Hitter | null = null;
  for (const g of games) for (const s of g.sides) if (!high || s.points > high.value) high = { kind: 'high', userId: s.userId, loser: null, value: s.points, matchupId: g.matchupId };
  if (high) out.push(high);
  const decided = games.filter((g) => g.winner !== null);
  const hitter = (kind: 'blowout' | 'nail', better: (m: number, best: number) => boolean): Hitter | null => {
    let best: Hitter | null = null;
    for (const g of decided) {
      if (best && !better(g.margin, best.value)) continue;
      const loser = g.sides.find((s) => s.userId !== g.winner)!.userId;
      best = { kind, userId: g.winner!, loser, value: g.margin, matchupId: g.matchupId };
    }
    return best;
  };
  const blowout = hitter('blowout', (m, b) => m > b);
  const nail = hitter('nail', (m, b) => m < b);
  if (blowout) out.push(blowout);
  if (nail) out.push(nail);
  return out;
}

export interface Performer { playerId: PlayerId; userId: UserId; points: number; stats: Record<string, number> }

/** The week's highest-scoring starters; ties by player name. */
export function topPerformers(week: Week, players: PlayerDirectory, n = 5): Performer[] {
  const all: Performer[] = [];
  for (const g of week.games) for (const s of g.sides) for (const e of s.starters) {
    if (e.player) all.push({ playerId: e.player.playerId, userId: s.userId, points: e.player.points, stats: e.player.stats });
  }
  return all
    .sort((x, y) => y.points - x.points || playerName(players, x.playerId).localeCompare(playerName(players, y.playerId)))
    .slice(0, n);
}

const v = (s: Record<string, number>, k: string) => s[k] ?? 0;

/** "23/41, 313 yds, 2 TD · 16 car, 64 yds, 2 TD · 9/10 rec, 53 yds · 1 fum"; zero parts left out. */
export function fullStatLine(s: Record<string, number>): string {
  const parts: string[] = [];
  const td = (n: number, label = 'TD') => (n ? `, ${n} ${label}` : '');
  if (v(s, 'pass_att')) parts.push(`${v(s, 'pass_cmp')}/${v(s, 'pass_att')}, ${v(s, 'pass_yd')} yds${td(v(s, 'pass_td'))}${td(v(s, 'pass_int'), 'INT')}`);
  if (v(s, 'rush_att')) parts.push(`${v(s, 'rush_att')} car, ${v(s, 'rush_yd')} yds${td(v(s, 'rush_td'))}`);
  if (v(s, 'rec') || v(s, 'rec_tgt')) parts.push(`${v(s, 'rec')}${v(s, 'rec_tgt') ? `/${v(s, 'rec_tgt')}` : ''} rec, ${v(s, 'rec_yd')} yds${td(v(s, 'rec_td'))}`);
  if (v(s, 'fga') || v(s, 'xpa')) parts.push(`${v(s, 'fgm')}/${v(s, 'fga')} FG, ${v(s, 'xpm')}/${v(s, 'xpa')} XP`);
  const def = [[v(s, 'sack'), 'sck'], [v(s, 'int'), 'INT'], [v(s, 'def_td'), 'TD']].filter(([n]) => n).map(([n, l]) => `${n} ${l}`);
  if (def.length) parts.push(def.join(', '));
  if (v(s, 'fum_lost')) parts.push(`${v(s, 'fum_lost')} fum`);
  return parts.join(' · ');
}
