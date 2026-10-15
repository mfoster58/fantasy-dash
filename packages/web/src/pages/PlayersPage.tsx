import { useLoaderData } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import PlayersView from '../components/players/PlayersView';
import { currentSeason, history, players } from '../data/load';

export default function PlayersPage() {
  const seasons = useLoaderData() as Season[];
  return <PlayersView seasons={seasons} players={players} managers={history.managers} years={history.seasons.map((s) => s.year)} currentYear={currentSeason.year} lastScoredWeek={currentSeason.lastScoredWeek} />;
}
