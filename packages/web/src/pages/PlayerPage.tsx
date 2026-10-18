import { useLoaderData } from 'react-router';
import type { PlayerDb, PlayerId, Season } from '@fantasy-dash/core';
import { players } from '../data/load';
import { playerName } from '../lib/players';

export interface PlayerPageData { id: PlayerId; seasons: Season[]; dbs: PlayerDb[] }

export default function PlayerPage() {
  const { id } = useLoaderData() as PlayerPageData;
  return <h1 className="text-2xl font-semibold tracking-tight">{playerName(players, id)}</h1>;
}
