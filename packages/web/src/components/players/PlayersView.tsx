import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { History, PlayerDirectory, Season } from '@fantasy-dash/core';
import { BOARDS, championsOf, draftValuesOf, lastPlacesOf, type BoardContext, type Section as SectionId } from '../../lib/playerBoards';
import { filterLines, flattenLines, isPosFilter, type PosFilter } from '../../lib/playerLines';
import { fitXfp } from '../../lib/xfp';
import Section from './Section';

interface Props { seasons: Season[]; players: PlayerDirectory; managers: History['managers']; years: number[]; currentYear: number; lastScoredWeek: number }

type SeasonPick = number | 'all';
const SECTIONS: { id: SectionId; param: string; seasonParam: string | null; defaultSeason: 'current' | 'all' | null; title: string; note: string | null; columns: 2 | 3 }[] = [
  { id: 'leaders', param: 'lead', seasonParam: 'season', defaultSeason: 'current', title: 'League leaders', note: null, columns: 3 },
  { id: 'career', param: 'career', seasonParam: 'careerSeason', defaultSeason: 'all', title: 'Career', note: null, columns: 2 },
  { id: 'postseason', param: 'post', seasonParam: null, defaultSeason: null, title: 'Postseason', note: 'Championship bracket unless the board says otherwise', columns: 2 },
  { id: 'extras', param: 'extra', seasonParam: 'extrasSeason', defaultSeason: 'all', title: 'Extras', note: null, columns: 2 },
];

export default function PlayersView({ seasons, players, managers, years, currentYear, lastScoredWeek }: Props) {
  const [params, setParams] = useSearchParams();
  const update = (mutate: (next: URLSearchParams) => void) => { const next = new URLSearchParams(params); mutate(next); setParams(next, { replace: true }); };
  const posOf = (param: string): PosFilter => { const raw = params.get(param); return isPosFilter(raw) ? raw : 'All'; };
  const setPos = (param: string) => (p: PosFilter) => update((next) => { if (p === 'All') next.delete(param); else next.set(param, p); });
  const pickOf = (param: string, fallback: SeasonPick): SeasonPick => {
    const raw = params.get(param);
    if (raw === 'all') return 'all';
    const n = Number(raw);
    return years.includes(n) ? n : fallback;
  };
  const setPick = (param: string, fallback: SeasonPick) => (v: SeasonPick) => update((next) => { if (v === fallback) next.delete(param); else next.set(param, String(v)); });

  const allLines = useMemo(() => flattenLines(seasons, players), [seasons, players]);
  const champions = useMemo(() => championsOf(seasons), [seasons]);
  const lastPlaces = useMemo(() => lastPlacesOf(seasons), [seasons]);
  const picks = useMemo(() => draftValuesOf(seasons), [seasons]);
  const xfp = useMemo(() => fitXfp(allLines), [allLines]);
  const transactions = useMemo(() => seasons.map((s) => ({ year: s.year, transactions: s.transactions })), [seasons]);
  const playerSeasons = useMemo(() => Object.fromEntries(seasons.map((s) => [s.year, s.playerSeasons])), [seasons]);
  const drafts = useMemo(() => Object.fromEntries(seasons.map((s) => [s.year, s.draft])), [seasons]);

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
        const fallback: SeasonPick = s.defaultSeason === 'current' ? currentYear : 'all';
        const pick: SeasonPick = s.seasonParam ? pickOf(s.seasonParam, fallback) : 'all';
        const year = pick === 'all' ? null : pick;
        const lines = filterLines(allLines, pos).filter((l) => year === null || l.year === year);
        const ctx: BoardContext = { lines, players, champions, lastPlaces, year, currentYear, pos, picks, xfp, transactions, playerSeasons, drafts };
        const note = s.note ?? (year === null ? 'Every season' : `${year} season`);
        const empty = s.id === 'leaders' && year !== null && !allLines.some((l) => l.year === year) ? 'Season has not started.' : null;
        return (
          <Section
            key={s.id}
            id={s.id}
            title={s.title}
            note={note}
            boards={BOARDS.filter((b) => b.section === s.id)}
            ctx={ctx}
            players={players}
            managers={managers}
            pos={pos}
            onPos={setPos(s.param)}
            columns={s.columns}
            seasonPicker={s.seasonParam ? { years, value: pick, onChange: setPick(s.seasonParam, fallback), allTime: true } : undefined}
            emptyMessage={empty}
          />
        );
      })}
    </section>
  );
}
