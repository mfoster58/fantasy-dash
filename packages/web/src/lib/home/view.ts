import type { Game } from '@fantasy-dash/core';
import { K, phi, type GameOutlook, type LiveStatus } from '../live/outlook';

export interface GameView {
  status: LiveStatus;
  /** projected totals before kickoff, points once it starts */
  scores: [number, number];
  projected: [number, number];
  /** whole percents; null once final */
  win: [number, number] | null;
  /** starters still to play each side; null when unknown */
  toPlay: [number | null, number | null];
  /** index of the winning side, only once final */
  winner: 0 | 1 | null;
}

/** Win % from two projected totals before anything is played. */
export function pregameWin(a: number, b: number): [number, number] {
  if (a + b <= 0) return [50, 50];
  const p = Math.max(1, Math.min(99, Math.round(phi((a - b) / Math.sqrt(K * (a + b))) * 100)));
  return [p, 100 - p];
}

export function gameView(game: Game, outlook: GameOutlook | null, played: boolean, toPlay: [number | null, number | null] = [null, null]): GameView {
  const [a, b] = game.sides;
  const status: LiveStatus = outlook?.status ?? (played ? 'final' : 'upcoming');
  const projected: [number, number] = outlook?.projected ?? [a.projected, b.projected];
  if (status === 'upcoming') return { status, scores: projected, projected, win: outlook?.win ?? pregameWin(projected[0], projected[1]), toPlay, winner: null };
  const scores: [number, number] = [a.points, b.points];
  if (status === 'live') return { status, scores, projected, win: outlook?.win ?? null, toPlay, winner: null };
  return { status, scores, projected, win: null, toPlay: [0, 0], winner: a.points === b.points ? null : a.points > b.points ? 0 : 1 };
}
