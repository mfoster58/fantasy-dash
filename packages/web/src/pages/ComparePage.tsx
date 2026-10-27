import { useMemo } from 'react';
import { useLoaderData, useNavigate, useSearchParams } from 'react-router';
import type { ChartDb, PlayerDb, Schedule } from '@fantasy-dash/core';
import AdvancedTable from '../components/compare/AdvancedTable';
import CompareCard from '../components/compare/CompareCard';
import CompareCharts from '../components/compare/CompareCharts';
import PlayerSlot from '../components/compare/PlayerSlot';
import PlayersTabs from '../components/compare/PlayersTabs';
import { Seg } from '../components/charts/Field';
import SeasonPicker from '../components/SeasonPicker';
import { leaders } from '../lib/compare/leaders';
import { nextFive, playerSummary } from '../lib/compare/summary';
import { compareHref, GROUP_LABEL, MAX_SLOTS, parseCompare, POS_GROUPS, type CompareState, type PosGroup } from '../lib/compare/url';
import { gradeCards } from '../lib/grades/grade';

export interface CompareData { years: number[]; season: number; db: PlayerDb | null; chart: ChartDb | null; schedule: Schedule | null }

export default function ComparePage() {
  const { years, season, db, chart, schedule } = useLoaderData() as CompareData;
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const state = useMemo(() => parseCompare(params, years, db), [params, years, db]);
  const go = (s: CompareState) => navigate(compareHref(s), { replace: true });

  const picked = useMemo(() => (db ? state.ids.map((id) => {
    const p = db.players[id];
    const summary = playerSummary(db, id, schedule);
    return { id, name: p.name, pos: p.pos, gsis: p.gsisId, summary, next: nextFive(db, schedule, summary.team, p.pos), cards: gradeCards(db, chart ?? undefined, id) };
  }) : []), [db, chart, schedule, state.ids]);

  const lead = useMemo(() => {
    const s = picked.map((p) => p.summary);
    const floor = leaders(s.map((x) => x.floor)), avg = leaders(s.map((x) => x.avg)), ceil = leaders(s.map((x) => x.ceil)), cv = leaders(s.map((x) => x.cv), true);
    return picked.map((_, i) => ({ floor: floor[i], avg: avg[i], ceil: ceil[i], cv: cv[i] }));
  }, [picked]);

  const setSlot = (i: number, id: string | null) => {
    const ids = [...state.ids];
    if (id === null) ids.splice(i, 1); else if (i < ids.length) ids[i] = id; else ids.push(id);
    go({ ...state, ids });
  };
  // always four slots; filled ones first, so a pick in any empty slot lands in the next letter
  const slots = MAX_SLOTS;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Players</h1>
        <PlayersTabs active="compare" season={state.season} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Seg label="Position" options={POS_GROUPS.map((g) => [g, GROUP_LABEL[g]] as [PosGroup, string])} value={state.pos} onChange={(pos) => go({ ...state, pos, ids: [] })} />
        <SeasonPicker years={years} value={state.season} onChange={(v) => { if (v !== 'all') go({ ...state, season: v }); }} />
      </div>
      {!db ? <p className="card px-4 py-6 text-sm text-muted">No player data yet for {season}</p> : (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: slots }, (_, i) => (
              <PlayerSlot key={`${i}-${state.ids[i] ?? ''}`} index={i} db={db} pos={state.pos} value={state.ids[i] ?? null} taken={state.ids} onPick={(id) => setSlot(i, id)} />
            ))}
          </div>
          {picked.length === 0 ? <p className="card px-4 py-8 text-center text-sm text-muted">Pick up to four players to compare</p> : (
            <>
              <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                {picked.map((p, i) => <CompareCard key={p.id} index={i} name={p.name} pos={p.pos} summary={p.summary} next={p.next} lead={lead[i]} />)}
              </div>
              <AdvancedTable names={picked.map((p) => p.name)} cards={picked.map((p) => p.cards)} />
              <CompareCharts group={state.pos} players={picked.map((p) => ({ gsis: p.gsis, name: p.name, pos: p.pos }))} chart={chart} />
            </>
          )}
        </>
      )}
    </div>
  );
}
