import type { Game, GameSide } from '@fantasy-dash/core';
import { fractionLeft, type PlayerGame } from './gameState';

/**
 * Variance of a team's final score per projected point still to play. In this league over 2023-2025
 * (420 team-weeks) actual minus projected had an SD of 24.1 against a mean projection of 130.7: 24.1² / 130.7 ≈ 4.4.
 */
export const K = 4.4;

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, error < 1.5e-7). */
export function phi(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

export interface PlayerOutlook { final: number; remaining: number }

export function playerOutlook(points: number, projected: number | null, g: PlayerGame): PlayerOutlook {
  const p = projected ?? 0;
  switch (g.kind) {
    case 'live': { const rest = p * fractionLeft(g); return { final: points + rest, remaining: rest }; }
    case 'final':
    case 'bye': return { final: points, remaining: 0 };
    case 'upcoming': return { final: p, remaining: p };
    default: return { final: Math.max(points, p), remaining: p };
  }
}

export type LiveStatus = 'upcoming' | 'live' | 'final';
export interface GameOutlook {
  /** each side's projected final */
  projected: [number, number];
  /** whole percents, summing to 100 */
  win: [number, number];
  status: LiveStatus;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function gameOutlook(game: Game, gameOf: (playerId: string) => PlayerGame): GameOutlook {
  const states: PlayerGame[] = [];
  const isDone = (g: PlayerGame) => g.kind === 'final' || g.kind === 'bye';
  const sum = (side: GameSide) => {
    let final = 0, remaining = 0, left = 0;
    for (const e of side.starters) {
      if (!e.player) continue;
      const g = gameOf(e.player.playerId);
      states.push(g);
      if (!isDone(g)) left++;
      const o = playerOutlook(e.player.points, e.player.projected, g);
      final += o.final;
      remaining += o.remaining;
    }
    return { final: round2(final), remaining, left };
  };
  const [a, b] = [sum(game.sides[0]), sum(game.sides[1])];
  const [pa0, pb0] = [game.sides[0].points, game.sides[1].points];
  // over when nobody is left to play, or when the side behind has nobody left
  const decided = (a.left === 0 && pa0 < pb0) || (b.left === 0 && pb0 < pa0);
  const done = (states.length > 0 && states.every(isDone)) || decided;
  const started = states.some((g) => g.kind === 'live' || g.kind === 'final') || game.sides.some((s) => s.points > 0);
  const status: LiveStatus = done ? 'final' : started ? 'live' : 'upcoming';

  const variance = K * (a.remaining + b.remaining);
  const diff = a.final - b.final;
  let pa = variance > 0 ? Math.round(phi(diff / Math.sqrt(variance)) * 100) : diff > 0 ? 100 : diff < 0 ? 0 : 50;
  // only a finished game is certain
  if (status !== 'final') pa = Math.max(1, Math.min(99, pa));
  else if (decided) pa = pa0 > pb0 ? 100 : 0;
  return { projected: [a.final, b.final], win: [pa, 100 - pa], status };
}

/** win % colour: the favourite green, the underdog red, a dead-even game neither */
export const winTone = (mine: number, theirs: number): string => (mine > theirs ? 'var(--win)' : mine < theirs ? 'var(--loss)' : 'var(--dim)');
