import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { History, PlayerDirectory, Season } from '@fantasy-dash/core';
import { BOARDS, championsOf, type BoardContext, type Section } from '../../lib/playerBoards';
import { filterLines, flattenLines, isPosFilter, type PosFilter } from '../../lib/playerLines';
import Board from './Board';
import PositionFilter from './PositionFilter';

interface Props { seasons: Season[]; players: PlayerDirectory; managers: History['managers']; currentYear: number; lastScoredWeek: number }

const SECTIONS: { id: Section; title: string; note: string }[] = [
  { id: 'leaders', title: 'League leaders', note: 'This season, any roster' },
  { id: 'allTime', title: 'All-time', note: 'Every season' },
  { id: 'postseason', title: 'Postseason', note: 'Championship bracket only. Consolation games do not count.' },
  { id: 'extras', title: 'Extras', note: 'Every season' },
];

export default function PlayersView({ seasons, players, managers, currentYear, lastScoredWeek }: Props) {
  const [params, setParams] = useSearchParams();
  const raw = params.get('pos');
  const pos: PosFilter = isPosFilter(raw) ? raw : 'All';
  const setPos = (p: PosFilter) => {
    const next = new URLSearchParams(params);
    if (p === 'All') next.delete('pos'); else next.set('pos', p);
    setParams(next, { replace: true });
  };

  const allLines = useMemo(() => flattenLines(seasons, players), [seasons, players]);
  const champions = useMemo(() => championsOf(seasons), [seasons]);
  const ctx: BoardContext = useMemo(() => ({ lines: filterLines(allLines, pos), players, champions, currentYear, pos, picks: [], xfp: null }), [allLines, pos, players, champions, currentYear]);
  const seasonStarted = allLines.some((l) => l.year === currentYear);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold">Player stats <span className="num font-normal text-muted">through {currentYear} week {lastScoredWeek}</span></h1>
        <nav aria-label="Sections" className="flex flex-wrap gap-3 text-xs">
          {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className="text-muted hover:text-accent">{s.title}</a>)}
        </nav>
      </header>
      <div className="sticky top-12 z-[5] -mx-4 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <PositionFilter value={pos} onChange={setPos} />
      </div>
      {SECTIONS.map((s) => {
        const boards = BOARDS.filter((b) => b.section === s.id);
        return (
          <section key={s.id} id={s.id} className="scroll-mt-28 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <span className="text-xs text-muted">{s.note}</span>
            </div>
            {s.id === 'leaders' && !seasonStarted ? (
              <p className="card p-4 text-sm text-muted">Season has not started.</p>
            ) : (
              <div className={`grid gap-4 ${s.id === 'leaders' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                {boards.map((b) => <Board key={b.id} def={b} rows={b.compute(ctx)} players={players} managers={managers} />)}
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}
