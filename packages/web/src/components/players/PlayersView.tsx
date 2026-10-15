import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { History, PlayerDirectory, Season } from '@fantasy-dash/core';
import { BOARDS, championsOf, draftValuesOf, lastPlacesOf, type BoardContext, type Section as SectionId } from '../../lib/playerBoards';
import { filterLines, flattenLines, isPosFilter, type PosFilter } from '../../lib/playerLines';
import { fitXfp } from '../../lib/xfp';
import Section from './Section';

interface Props { seasons: Season[]; players: PlayerDirectory; managers: History['managers']; years: number[]; currentYear: number; lastScoredWeek: number }

const SECTIONS: { id: SectionId; param: string; title: string; note: string; columns: 2 | 3 }[] = [
  { id: 'leaders', param: 'lead', title: 'League leaders', note: 'Any roster, started or benched', columns: 3 },
  { id: 'allTime', param: 'all', title: 'All-time', note: 'Every season', columns: 2 },
  { id: 'postseason', param: 'post', title: 'Postseason', note: 'Championship bracket unless the board says otherwise', columns: 2 },
  { id: 'extras', param: 'extra', title: 'Extras', note: 'Every season', columns: 2 },
];

export default function PlayersView({ seasons, players, managers, years, currentYear, lastScoredWeek }: Props) {
  const [params, setParams] = useSearchParams();
  const update = (mutate: (next: URLSearchParams) => void) => { const next = new URLSearchParams(params); mutate(next); setParams(next, { replace: true }); };
  const posOf = (param: string): PosFilter => { const raw = params.get(param); return isPosFilter(raw) ? raw : 'All'; };
  const setPos = (param: string) => (p: PosFilter) => update((next) => { if (p === 'All') next.delete(param); else next.set(param, p); });
  const seasonParam = Number(params.get('season'));
  const leadersYear = years.includes(seasonParam) ? seasonParam : currentYear;
  const setSeason = (y: number) => update((next) => { if (y === currentYear) next.delete('season'); else next.set('season', String(y)); });

  const allLines = useMemo(() => flattenLines(seasons, players), [seasons, players]);
  const champions = useMemo(() => championsOf(seasons), [seasons]);
  const lastPlaces = useMemo(() => lastPlacesOf(seasons), [seasons]);
  const picks = useMemo(() => draftValuesOf(seasons), [seasons]);
  const xfp = useMemo(() => fitXfp(allLines), [allLines]);
  const leadersHasLines = allLines.some((l) => l.year === leadersYear);

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold">Player stats <span className="num font-normal text-muted">through {currentYear} week {lastScoredWeek}</span></h1>
        <nav aria-label="Sections" className="flex flex-wrap gap-3 text-xs">
          {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`} className="text-muted hover:text-accent">{s.title}</a>)}
        </nav>
      </header>
      {SECTIONS.map((s) => {
        const pos = posOf(s.param);
        const ctx: BoardContext = { lines: filterLines(allLines, pos), players, champions, lastPlaces, currentYear: s.id === 'leaders' ? leadersYear : currentYear, pos, picks, xfp };
        return (
          <Section
            key={s.id}
            id={s.id}
            title={s.title}
            note={s.note}
            boards={BOARDS.filter((b) => b.section === s.id)}
            ctx={ctx}
            players={players}
            managers={managers}
            pos={pos}
            onPos={setPos(s.param)}
            columns={s.columns}
            seasonPicker={s.id === 'leaders' ? { years, value: leadersYear, onChange: setSeason } : undefined}
            emptyMessage={s.id === 'leaders' && !leadersHasLines ? 'Season has not started.' : null}
          />
        );
      })}
    </section>
  );
}
