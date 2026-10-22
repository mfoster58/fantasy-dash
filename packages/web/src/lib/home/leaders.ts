import type { History, PlayerDirectory, Season } from '@fantasy-dash/core';
import {
  championsOf, lastPlacesOf, leadFpoe, leadPassTd, leadPassYards, leadRecTd, leadRecYards, leadRushTd, leadRushYards,
  leadTouchdowns, leadXfp, leadYards, type BoardContext, type BoardDef,
} from '../playerBoards';
import { filterLines, flattenLines, type PosFilter } from '../playerLines';
import { fitXfp } from '../xfp';

export type Split = 'all' | 'pass' | 'rush' | 'rec';
export const YARD_BOARDS: Record<Split, BoardDef['compute']> = { all: leadYards, pass: leadPassYards, rush: leadRushYards, rec: leadRecYards };
export const TD_BOARDS: Record<Split, BoardDef['compute']> = { all: leadTouchdowns, pass: leadPassTd, rush: leadRushTd, rec: leadRecTd };
export const MODEL_BOARDS: Record<'fpoe' | 'xfp', BoardDef['compute']> = { fpoe: leadFpoe, xfp: leadXfp };

/** The board context the Records Leaders tab used, for one season; the xFP fit sees every season. */
export function homeLeaderContext(seasons: Season[], players: PlayerDirectory, managers: History['managers'], year: number): (pos: PosFilter) => BoardContext {
  const allLines = flattenLines(seasons, players);
  const yearLines = allLines.filter((l) => l.year === year);
  const xfp = fitXfp(allLines);
  const champions = championsOf(seasons);
  const lastPlaces = lastPlacesOf(seasons);
  return (pos) => ({
    lines: filterLines(yearLines, pos), allLines, players, champions, lastPlaces, year, currentYear: year, pos, picks: [], xfp,
    transactions: [], playerSeasons: {}, drafts: {}, teamGames: [], managerSeasons: [], managers,
  });
}
