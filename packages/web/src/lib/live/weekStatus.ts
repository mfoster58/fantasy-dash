import type { Game, GameSide, Season, Week } from '@fantasy-dash/core';
import { players } from '../../data/load';
import { playerTeam } from '../players';
import { playerGames } from './gameState';
import type { LiveData } from './LiveProvider';
import { gameOutlook, type GameOutlook } from './outlook';
import { liveWeek } from './overlay';

export interface WeekStatus {
  week: Week;
  isLive: boolean;
  /** the live week is under way: an NFL game has kicked off, or (without ESPN) someone has points */
  started: boolean;
  outlookOf: (g: Game) => GameOutlook | null;
  /** starters whose NFL game is upcoming or in progress; null unless live with ESPN read */
  toPlay: (s: GameSide) => number | null;
}

/** A synced week as it stands now: live points and outlooks when it's the live week, the synced week otherwise. */
export function weekStatus(season: Season, wk: Week, live: LiveData): WeekStatus {
  const isLive = live.season?.year === season.year && live.week === wk.week && live.matchups !== null;
  if (!isLive) return { week: wk, isLive, started: false, outlookOf: () => null, toPlay: () => null };
  const week = liveWeek(wk, season.managers, live.matchups!, live.stats, live.projections ? { map: live.projections, scoring: season.scoring } : null);
  const gameOf = playerGames((id) => playerTeam(players, id, season.playerTeams), live.games);
  const toPlay = (s: GameSide) => (live.games === null ? null
    : s.starters.filter((e) => e.player && ['upcoming', 'live'].includes(gameOf(e.player.playerId).kind)).length);
  const started = live.games !== null ? live.games.some((g) => g.state !== 'pre') : live.matchups!.some((m) => (m.points ?? 0) > 0);
  return { week, isLive, started, outlookOf: (g) => gameOutlook(g, gameOf), toPlay };
}
