import type { BracketGame, BracketKind, Honors, PlayoffTag, SeasonStatus, StandingRow, UserId } from './types';
import type { SleeperBracketGame } from './sleeper/types';

export function tagFor(kind: BracketKind, round: number, placement: number | null): PlayoffTag {
  if (kind === 'winners') {
    if (placement === 1) return 'Final';
    if (placement === 3) return '3rd';
    if (placement === 5) return '5th';
    return round === 1 ? 'QF' : 'SF';
  }
  if (placement === 1) return 'Toilet Bowl';
  if (placement === 3) return 'Cons-7th';
  return 'Cons-R1';
}

/**
 * Turn Sleeper's bracket into resolved games. Who played whom comes from the
 * bracket; who advanced comes from the scores. Winners bracket: higher scorer
 * advances. Consolation (toilet bowl): lower scorer advances. Ties fall back to
 * Sleeper's `w` field.
 */
export function resolveBracket(
  raw: SleeperBracketGame[],
  kind: BracketKind,
  playoffWeekStart: number,
  rosterToUser: Record<number, UserId>,
  weekPoints: (week: number, userId: UserId) => number | null,
): BracketGame[] {
  return raw.map((g) => {
    const week = playoffWeekStart + g.r - 1;
    const home = g.t1 != null ? rosterToUser[g.t1] ?? null : null;
    const away = g.t2 != null ? rosterToUser[g.t2] ?? null : null;
    const homePoints = home ? weekPoints(week, home) : null;
    const awayPoints = away ? weekPoints(week, away) : null;

    let advanced: UserId | null = null;
    if (home && away && homePoints !== null && awayPoints !== null) {
      if (homePoints === awayPoints) {
        advanced = g.w != null ? rosterToUser[g.w] ?? null : null;
      } else {
        const higher = homePoints > awayPoints ? home : away;
        const lower = higher === home ? away : home;
        advanced = kind === 'winners' ? higher : lower;
      }
    }

    return {
      bracket: kind,
      round: g.r,
      matchNo: g.m,
      placement: g.p ?? null,
      week,
      tag: tagFor(kind, g.r, g.p ?? null),
      home, away, homePoints, awayPoints, advanced,
      gameId: null,
    };
  });
}

export function tagForGame(brackets: BracketGame[], week: number, a: UserId, b: UserId): PlayoffTag | null {
  const g = brackets.find(
    (x) => x.week === week && ((x.home === a && x.away === b) || (x.home === b && x.away === a)),
  );
  return g?.tag ?? null;
}

function otherSide(g: BracketGame | undefined): UserId | null {
  if (!g || !g.advanced) return null;
  return g.advanced === g.home ? g.away : g.home;
}

export function computeHonors(
  winners: BracketGame[],
  consolation: BracketGame[],
  standings: StandingRow[],
  status: SeasonStatus,
): Honors {
  if (status !== 'complete') {
    return { champion: null, runnerUp: null, third: null, pointsTitle: null, lastPlace: null };
  }
  const final = winners.find((g) => g.tag === 'Final');
  const third = winners.find((g) => g.tag === '3rd');
  const toilet = consolation.find((g) => g.tag === 'Toilet Bowl');
  const pointsTitle = [...standings].sort((x, y) => y.pf - x.pf)[0]?.userId ?? null;
  return {
    champion: final?.advanced ?? null,
    runnerUp: otherSide(final),
    third: third?.advanced ?? null,
    pointsTitle,
    lastPlace: toilet?.advanced ?? null,
  };
}
