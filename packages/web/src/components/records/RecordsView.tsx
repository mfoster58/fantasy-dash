import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { History, PlayerDirectory, Season } from '@fantasy-dash/core';
import { boardsFor, championsOf, draftValuesOf, lastPlacesOf, type BoardContext, type Tab } from '../../lib/playerBoards';
import { SUB_TABS, TABS, subTabsOf, type SubTab } from '../../lib/boards/tabs';
import { managerSeasonsOf, teamGamesOf } from '../../lib/managerGames';
import { filterLines, flattenLines, isPosFilter, type PosFilter } from '../../lib/playerLines';
import { fitXfp } from '../../lib/xfp';
import Section from '../players/Section';

interface Props { seasons: Season[]; players: PlayerDirectory; managers: History['managers']; years: number[]; currentYear: number; lastScoredWeek: number }
type SeasonPick = number | 'all';

const tabButton = (selected: boolean) => `-mb-px border-b-2 px-3 py-2 text-sm ${selected ? 'border-ink font-medium text-ink' : 'border-transparent text-muted hover:text-ink'}`;

export default function RecordsView({ seasons, players, managers, years, currentYear, lastScoredWeek }: Props) {
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

  const tab: Tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'players';
  const subs = subTabsOf(tab);
  const sub = subs.find((s) => s.id === params.get('sub'))?.id ?? subs[0].id;
  const setTab = (id: Tab) => { if (id === tab) return; update((next) => { if (id === 'players') next.delete('tab'); else next.set('tab', id); next.delete('sub'); }); };
  const setSub = (id: string) => update((next) => { if (id === subs[0].id) next.delete('sub'); else next.set('sub', id); });

  const allLines = useMemo(() => flattenLines(seasons, players), [seasons, players]);
  const champions = useMemo(() => championsOf(seasons), [seasons]);
  const lastPlaces = useMemo(() => lastPlacesOf(seasons), [seasons]);
  const picks = useMemo(() => draftValuesOf(seasons), [seasons]);
  const xfp = useMemo(() => fitXfp(allLines), [allLines]);
  const transactions = useMemo(() => seasons.map((s) => ({ year: s.year, transactions: s.transactions })), [seasons]);
  const playerSeasons = useMemo(() => Object.fromEntries(seasons.map((s) => [s.year, s.playerSeasons])), [seasons]);
  const drafts = useMemo(() => Object.fromEntries(seasons.map((s) => [s.year, s.draft])), [seasons]);
  const allTeamGames = useMemo(() => teamGamesOf(seasons), [seasons]);
  const allManagerSeasons = useMemo(() => managerSeasonsOf(seasons, allTeamGames), [seasons, allTeamGames]);

  const panel = (s: SubTab) => {
    const pos = s.positions ? posOf(s.id) : 'All';
    const fallback: SeasonPick = s.picker === 'current' ? currentYear : 'all';
    const pick: SeasonPick = s.picker ? pickOf(`${s.id}Season`, fallback) : 'all';
    const year = pick === 'all' ? null : pick;
    const lines = filterLines(allLines, pos).filter((l) => year === null || l.year === year);
    const teamGames = allTeamGames.filter((g) => year === null || g.year === year);
    const managerSeasons = allManagerSeasons.filter((m) => year === null || m.year === year);
    const ctx: BoardContext = { lines, players, champions, lastPlaces, year, currentYear, pos, picks, xfp, transactions, playerSeasons, drafts, teamGames, managerSeasons, managers };
    const note = s.note ?? (year === null ? 'Every season' : `${year} season`);
    const empty = s.id === 'leaders' && year !== null && !allLines.some((l) => l.year === year) ? 'Season has not started.' : null;
    return (
      <Section
        key={s.id}
        id={s.id}
        title={s.title}
        note={note}
        boards={boardsFor(s.tab, s.id)}
        ctx={ctx}
        players={players}
        managers={managers}
        pos={pos}
        onPos={s.positions ? setPos(s.id) : undefined}
        columns={s.columns}
        seasonPicker={s.picker ? { years, value: pick, onChange: setPick(`${s.id}Season`, fallback), allTime: true } : undefined}
        emptyMessage={empty}
        hidden={s.tab !== tab || s.id !== sub}
      />
    );
  };

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <div>
          <h1 className="text-[22px] font-semibold">Records <span className="num font-normal text-muted">through {currentYear} week {lastScoredWeek}</span></h1>
          <p className="text-xs text-muted">Leaderboards about the players started in this league and the managers who ran them, scored by the league's own rules.</p>
        </div>
        <div role="tablist" aria-label="Tabs" className="flex gap-1 border-b border-line">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" id={`tab-top-${t.id}`} aria-selected={t.id === tab} aria-controls={`subtabs-${t.id}`} onClick={() => setTab(t.id)} className={tabButton(t.id === tab)}>
              {t.title}
            </button>
          ))}
        </div>
        <div role="tablist" aria-label="Sections" id={`subtabs-${tab}`} className="flex flex-wrap gap-1">
          {subs.map((s) => (
            <button key={s.id} type="button" role="tab" id={`tab-${s.id}`} aria-selected={s.id === sub} aria-controls={`panel-${s.id}`} onClick={() => setSub(s.id)} className={`rounded-full px-3 py-1 text-sm ${s.id === sub ? 'bg-ink text-bg' : 'bg-surface-2 text-muted hover:text-ink'}`}>
              {s.title} <span aria-hidden className="num text-xs opacity-70">{boardsFor(s.tab, s.id).length}</span>
            </button>
          ))}
        </div>
      </header>
      {/* every panel stays mounted so toggles and expand state survive a switch; the others are hidden */}
      {SUB_TABS.map(panel)}
    </section>
  );
}
