import type { BracketGame, BracketKind, Manager, UserId } from '@fantasy-dash/core';
import { CoverLink, TeamLink } from '../NameLink';
import { fmtPts, fmtTag } from '../../lib/format';

interface Props {
  games: BracketGame[]; kind: BracketKind; managers: Record<UserId, Manager>; year: number;
  /** each team's seed, shown before its name */
  seeds?: Record<UserId, number>;
}

const roundTitle = (kind: BracketKind, round: number, games: BracketGame[]) => {
  const tags = new Set(games.map((g) => g.tag));
  // A column of one kind of game takes that game's name; consolation round 1
  // ("Consolation") would repeat the section heading, so it falls back to the round.
  if (tags.size === 1 && !(kind === 'consolation' && games[0].tag === 'Cons-R1')) return fmtTag(games[0].tag);
  return `Round ${round}`;
};

const teamOf = (id: UserId | null, managers: Record<UserId, Manager>) => (id ? managers[id]?.teamName ?? managers[id]?.displayName ?? id : 'TBD');

function Side({ id, points, won, managers, year, seed }: { id: UserId | null; points: number | null; won: boolean; managers: Record<UserId, Manager>; year: number; seed?: number }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${won ? 'text-ink font-semibold' : 'text-muted'}`}>
      <span className="flex min-w-0 items-baseline gap-1.5">
        {id && seed !== undefined && <span data-testid={`seed-${id}`} className="num w-4 shrink-0 text-right text-xs text-muted">{seed}</span>}
        {id ? <TeamLink userId={id} year={year} className="relative z-10 truncate">{teamOf(id, managers)}</TeamLink> : <span className="truncate">TBD</span>}
      </span>
      {won && <span className="sr-only">winner</span>}
      <span className="num">{points === null ? '' : fmtPts(points)}</span>
    </div>
  );
}

export default function Bracket({ games, kind, managers, year, seeds }: Props) {
  const rounds = [...new Set(games.map((g) => g.round))].sort((a, b) => a - b);
  return (
    <div className="flex gap-4 overflow-x-auto pb-1">
      {rounds.map((round) => {
        const inRound = games.filter((g) => g.round === round).sort((a, b) => (a.placement ?? 0) - (b.placement ?? 0) || a.matchNo - b.matchNo);
        return (
          <div key={round} className="flex min-w-[220px] flex-1 flex-col gap-3">
            <div className="section-label">{roundTitle(kind, round, inRound)}</div>
            {inRound.map((g) => {
              const matchupId = g.gameId?.split('-').pop();
              // the card opens the box score through a cover link, so each team name can be its own link
              return (
                <div key={g.matchNo} className={`card relative p-3 text-sm ${g.gameId ? 'transition-colors hover:ring-1 hover:ring-accent/60' : ''}`}>
                  {g.gameId && <CoverLink to={`/scores/${year}/${g.week}/${matchupId}`} label={`${fmtTag(g.tag)}: ${teamOf(g.home, managers)} vs ${teamOf(g.away, managers)} box score`} className="rounded-xl" />}
                  {inRound.length > 1 && tagsDiffer(inRound) && <div className="section-label mb-1">{fmtTag(g.tag)}</div>}
                  <Side id={g.home} points={g.homePoints} won={wonBy(g, kind, 'home')} managers={managers} year={year} seed={g.home ? seeds?.[g.home] : undefined} />
                  <Side id={g.away} points={g.awayPoints} won={wonBy(g, kind, 'away')} managers={managers} year={year} seed={g.away ? seeds?.[g.away] : undefined} />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function tagsDiffer(games: BracketGame[]): boolean {
  return new Set(games.map((g) => g.tag)).size > 1;
}

/**
 * Winners bracket: the advancing team won. Consolation is a toilet bowl where the
 * lower scorer advances, so the game's winner is the higher scorer.
 */
function wonBy(g: BracketGame, kind: BracketKind, side: 'home' | 'away'): boolean {
  if (kind === 'winners') return g.advanced !== null && g.advanced === (side === 'home' ? g.home : g.away);
  if (g.homePoints === null || g.awayPoints === null) return false;
  return side === 'home' ? g.homePoints > g.awayPoints : g.awayPoints > g.homePoints;
}
