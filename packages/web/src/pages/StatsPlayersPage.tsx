import { useLoaderData } from 'react-router';
import type { ChartDb, PlayerDb } from '@fantasy-dash/core';
import PlayersStats from '../components/stats/players/PlayersStats';
import StatsTabs from '../components/stats/players/StatsTabs';
import { currentSeason, history } from '../data/load';

export interface StatsPlayersData { dbs: PlayerDb[]; charts: ChartDb[] }

export default function StatsPlayersPage() {
  const { dbs, charts } = useLoaderData() as StatsPlayersData;
  // the league's last scored week per season, so trends skip an unscored week 18
  const lastWeeks = Object.fromEntries(history.seasons.map((s) => [s.year, s.lastScoredWeek]));
  return <><StatsTabs /><PlayersStats dbs={dbs} charts={charts} currentYear={currentSeason.year} lastWeeks={lastWeeks} /></>;
}
