import { useLoaderData } from 'react-router';
import type { ChartDb, PlayerDb } from '@fantasy-dash/core';
import PlayersStats from '../components/stats/players/PlayersStats';
import StatsTabs from '../components/stats/players/StatsTabs';
import { currentSeason } from '../data/load';

export interface StatsPlayersData { dbs: PlayerDb[]; charts: ChartDb[] }

export default function StatsPlayersPage() {
  const { dbs, charts } = useLoaderData() as StatsPlayersData;
  return <><StatsTabs /><PlayersStats dbs={dbs} charts={charts} currentYear={currentSeason.year} /></>;
}
