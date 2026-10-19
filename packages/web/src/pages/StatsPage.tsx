import { useLoaderData } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import ManagersStats from '../components/stats/ManagersStats';
import StatsTabs from '../components/stats/players/StatsTabs';
import { currentSeason, history, players } from '../data/load';

export default function StatsPage() {
  const seasons = useLoaderData() as Season[];
  return <><StatsTabs /><ManagersStats seasons={seasons} players={players} years={history.seasons.map((s) => s.year)} currentYear={currentSeason.year} /></>;
}
