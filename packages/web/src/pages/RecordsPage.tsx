import { useLoaderData } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import RecordsView from '../components/records/RecordsView';
import { currentSeason, history, players } from '../data/load';

export default function RecordsPage() {
  const seasons = useLoaderData() as Season[];
  return <RecordsView seasons={seasons} players={players} managers={history.managers} years={history.seasons.map((s) => s.year)} currentYear={currentSeason.year} />;
}
