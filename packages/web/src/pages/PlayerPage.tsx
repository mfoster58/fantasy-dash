import { useMemo, useState } from 'react';
import { useLoaderData } from 'react-router';
import type { PlayerDb, PlayerId, Season } from '@fantasy-dash/core';
import AdvancedBySeason from '../components/player/AdvancedBySeason';
import GameLog from '../components/player/GameLog';
import JourneyFeed from '../components/player/JourneyFeed';
import PercentileBars from '../components/player/PercentileBars';
import PlayerHeader from '../components/player/PlayerHeader';
import SeasonTable from '../components/player/SeasonTable';
import LeagueRecords from '../components/teams/LeagueRecords';
import { history, players } from '../data/load';
import { allTimeContext } from '../lib/managerRecords';
import { bioOf } from '../lib/player/bio';
import { dbYearsOf } from '../lib/player/coverage';
import { journeyOf } from '../lib/player/journey';
import { percentileBars } from '../lib/player/percentiles';
import { playerRecords } from '../lib/player/records';
import { seasonTable, summaryOf } from '../lib/player/seasons';
import type { Tab } from '../lib/playerdb/columns';
import { flattenLines } from '../lib/playerLines';

export interface PlayerPageData { id: PlayerId; seasons: Season[]; dbs: PlayerDb[] }

/** positions the player database covers, and the Players-table tab for each */
const DB_TABS: Partial<Record<string, Tab>> = { QB: 'qb', RB: 'rb', WR: 'wr', TE: 'te' };

export default function PlayerPage() {
  const { id, seasons, dbs } = useLoaderData() as PlayerPageData;
  const allLines = useMemo(() => flattenLines(seasons, players), [seasons]);
  const lines = useMemo(() => allLines.filter((l) => l.playerId === id).sort((a, b) => a.year - b.year || a.week - b.week), [allLines, id]);
  const bio = useMemo(() => bioOf(id, players, dbs, new Date()), [id, dbs]);
  const table = useMemo(() => seasonTable(lines, seasons, id), [lines, seasons, id]);
  const stints = useMemo(() => journeyOf(lines, seasons, players, id), [lines, seasons, id]);
  const records = useMemo(() => (lines.length ? playerRecords(allTimeContext(seasons, players, history.managers), id, bio.pos) : []), [lines.length, seasons, id, bio.pos]);
  const dbYears = useMemo(() => dbYearsOf(dbs, id), [dbs, id]);
  const myDbs = useMemo(() => dbs.filter((d) => dbYears.includes(d.year)).sort((a, b) => a.year - b.year), [dbs, dbYears]);
  const tab = DB_TABS[bio.pos];
  const newest = dbYears[dbYears.length - 1] ?? 0;
  const [pctYear, setPctYear] = useState(newest);
  const [logYear, setLogYear] = useState(newest);
  const pctDb = myDbs.find((d) => d.year === pctYear);
  const logDb = myDbs.find((d) => d.year === logYear);
  const bars = useMemo(() => (pctDb ? percentileBars(pctDb, id) : null), [pctDb, id]);
  const logLines = useMemo(() => lines.filter((l) => l.year === logYear), [lines, logYear]);
  const rostered = lines.length > 0;
  const now = stints[0]?.to === null ? stints[0] : null;

  return (
    <div className="space-y-6">
      <PlayerHeader id={id} bio={bio} summary={summaryOf(table)} now={now} managerName={now ? history.managers[now.userId]?.displayName ?? now.userId : ''} rostered={rostered} />
      {table.rows.length > 0 && <SeasonTable table={table} pos={bio.pos} />}
      {tab && myDbs.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          {bars && <PercentileBars pos={bio.pos} bars={bars} years={dbYears} year={pctYear} onYear={setPctYear} />}
          <AdvancedBySeason id={id} dbs={myDbs} tab={tab} />
        </div>
      )}
      {tab && logDb && <GameLog id={id} db={logDb} lines={logLines} season={seasons.find((s) => s.year === logYear)} tab={tab} pos={bio.pos} years={dbYears} onYear={setLogYear} />}
      {rostered && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <JourneyFeed stints={stints} seasons={new Set(lines.map((l) => l.year)).size} />
          <LeagueRecords records={records} tab="players" />
        </div>
      )}
    </div>
  );
}
