import { useMemo, useState } from 'react';
import { useLoaderData } from 'react-router';
import type { ChartDb, PlayerDb, PlayerId, Season } from '@fantasy-dash/core';
import PassingZones from '../components/charts/PassingZones';
import PressureCard from '../components/charts/PressureCard';
import RouteTree from '../components/charts/RouteTree';
import RunLanes from '../components/charts/RunLanes';
import { ReceiverChart } from '../components/charts/TargetMap';
import AdvancedBySeason from '../components/player/AdvancedBySeason';
import GameLog from '../components/player/GameLog';
import JourneyFeed from '../components/player/JourneyFeed';
import GradesSection from '../components/player/grades/GradesSection';
import PlayerHeader from '../components/player/PlayerHeader';
import SeasonTable from '../components/player/SeasonTable';
import LeagueRecords from '../components/teams/LeagueRecords';
import { currentSeason, history, players } from '../data/load';
import { allTimeContext } from '../lib/managerRecords';
import { bioOf } from '../lib/player/bio';
import { dbYearsOf } from '../lib/player/coverage';
import { journeyOf } from '../lib/player/journey';
import { playerRecords } from '../lib/player/records';
import { seasonTable, summaryOf } from '../lib/player/seasons';
import type { Tab } from '../lib/playerdb/columns';
import { flattenLines } from '../lib/playerLines';

export interface PlayerPageData { id: PlayerId; seasons: Season[]; dbs: PlayerDb[]; charts: ChartDb[] }

/** positions the player database covers, and the Players-table tab for each */
const DB_TABS: Partial<Record<string, Tab>> = { QB: 'qb', RB: 'rb', WR: 'wr', TE: 'te' };

export default function PlayerPage() {
  const { id, seasons, dbs, charts } = useLoaderData() as PlayerPageData;
  const allLines = useMemo(() => flattenLines(seasons, players), [seasons]);
  const lines = useMemo(() => allLines.filter((l) => l.playerId === id).sort((a, b) => a.year - b.year || a.week - b.week), [allLines, id]);
  const bio = useMemo(() => bioOf(id, players, dbs, new Date()), [id, dbs]);
  const table = useMemo(() => seasonTable(lines, seasons, id), [lines, seasons, id]);
  const stints = useMemo(() => journeyOf(lines, seasons, players, id), [lines, seasons, id]);
  const records = useMemo(() => (lines.length ? playerRecords(allTimeContext(seasons, players, history.managers), id, bio.pos) : []), [lines.length, seasons, id, bio.pos]);
  const dbYears = useMemo(() => dbYearsOf(dbs, id), [dbs, id]);
  const myDbs = useMemo(() => dbs.filter((d) => dbYears.includes(d.year)).sort((a, b) => a.year - b.year), [dbs, dbYears]);
  // gsis ids are stable across seasons: take any season's
  const gsis = useMemo(() => dbs.map((d) => d.players[id]?.gsisId).find((g): g is string => !!g) ?? null, [dbs, id]);
  const tab = DB_TABS[bio.pos];
  const current = currentSeason?.year ?? 0;
  const newest = dbYears[dbYears.length - 1] ?? 0;
  const [logYear, setLogYear] = useState(newest);
  const logDb = myDbs.find((d) => d.year === logYear);
  const logLines = useMemo(() => lines.filter((l) => l.year === logYear), [lines, logYear]);
  // a draft pick or an add counts, even before he plays a week
  const rostered = lines.length > 0 || stints.length > 0;
  const now = stints.find((s) => s.to === null) ?? null;

  return (
    <div className="space-y-6">
      <PlayerHeader id={id} bio={bio} summary={summaryOf(table)} now={now} managerName={now ? history.managers[now.userId]?.displayName ?? now.userId : ''} rostered={rostered} />
      {table.rows.length > 0 && <SeasonTable table={table} pos={bio.pos} />}
      {tab && myDbs.length > 0 && <AdvancedBySeason id={id} dbs={myDbs} tab={tab} />}
      {gsis && (bio.pos === 'WR' || bio.pos === 'TE') && <ReceiverChart charts={charts} gsis={gsis} pos={bio.pos} current={current} />}
      {gsis && bio.pos === 'RB' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <RunLanes charts={charts} gsis={gsis} current={current} />
          <ReceiverChart charts={charts} gsis={gsis} pos="RB" current={current} />
        </div>
      )}
      {gsis && bio.pos === 'QB' && (
        <div className="grid gap-6 xl:grid-cols-2">
          <PassingZones charts={charts} gsis={gsis} current={current} />
          <PressureCard charts={charts} gsis={gsis} current={current} />
        </div>
      )}
      {gsis && bio.pos === 'QB' && <RouteTree charts={charts} gsis={gsis} pos="QB" current={current} />}
      {tab && myDbs.length > 0 && <GradesSection id={id} dbs={myDbs} charts={charts} />}
      {tab && logDb && <GameLog id={id} db={logDb} lines={logLines} season={seasons.find((s) => s.year === logYear)} tab={tab} pos={bio.pos} years={dbYears} onYear={setLogYear} />}
      {rostered && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] [&>*]:min-w-0">
          <JourneyFeed stints={stints} seasons={new Set(lines.map((l) => l.year)).size} id={id} />
          <div className="space-y-6"><LeagueRecords records={records} tab="players" /></div>
        </div>
      )}
    </div>
  );
}
