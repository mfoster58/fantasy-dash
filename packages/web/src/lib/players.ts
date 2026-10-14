import type { PlayerDirectory, PlayerId } from '@fantasy-dash/core';

export function playerName(players: PlayerDirectory, id: PlayerId): string {
  return players[id]?.name ?? id;
}
export function playerPos(players: PlayerDirectory, id: PlayerId): string {
  return players[id]?.position ?? '?';
}
export function playerTeam(players: PlayerDirectory, id: PlayerId): string {
  return players[id]?.team ?? '';
}
export function posColor(pos: string): string {
  return `var(--pos-${pos}, var(--muted))`;
}

const n = (stats: Record<string, number>, key: string) => stats[key] ?? 0;

/** Compact stat line for a box-score row. Empty string when there are no stats. */
export function statLine(pos: string, stats: Record<string, number>): string {
  if (Object.keys(stats).length === 0) return '';
  const parts: string[] = [];
  if (pos === 'QB' || n(stats, 'pass_att') > 0) {
    parts.push(`${n(stats, 'pass_cmp')}/${n(stats, 'pass_att')}, ${n(stats, 'pass_yd')} yds`);
    if (n(stats, 'pass_td')) parts.push(`${n(stats, 'pass_td')} TD`);
    if (n(stats, 'pass_int')) parts.push(`${n(stats, 'pass_int')} INT`);
  }
  if (n(stats, 'rush_att') > 0) {
    parts.push(`${n(stats, 'rush_att')} car ${n(stats, 'rush_yd')} yds${n(stats, 'rush_td') ? ` ${n(stats, 'rush_td')} TD` : ''}`);
  }
  if (n(stats, 'rec') > 0 || n(stats, 'rec_tgt') > 0) {
    parts.push(`${n(stats, 'rec')} rec ${n(stats, 'rec_yd')} yds${n(stats, 'rec_td') ? ` ${n(stats, 'rec_td')} TD` : ''}`);
  }
  if (pos === 'K') {
    parts.push(`${n(stats, 'fgm')}/${n(stats, 'fga')} FG, ${n(stats, 'xpm')}/${n(stats, 'xpa')} XP`);
  }
  if (pos === 'DEF') {
    parts.push(`${n(stats, 'pts_allow')} PA, ${n(stats, 'sack')} sck, ${n(stats, 'int')} INT${n(stats, 'def_td') ? `, ${n(stats, 'def_td')} TD` : ''}`);
  }
  if (n(stats, 'fum_lost')) parts.push(`${n(stats, 'fum_lost')} FUM`);
  return parts.join(' · ');
}
