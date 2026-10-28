import { useMemo } from 'react';
import { Link, useLoaderData } from 'react-router';
import type { Season } from '@fantasy-dash/core';
import SeasonBanner from '../components/history/SeasonBanner';
import { seasonHardware } from '../lib/history/hardware';

/** League history: one banner per season, newest first, led by its champion with the rest of the hardware beside. */
export default function HistoryPage() {
  const seasons = useLoaderData() as Season[];
  const banners = useMemo(() => [...seasons].sort((a, b) => b.year - a.year).map(seasonHardware), [seasons]);
  return (
    <section className="space-y-4">
      <header><h1 className="text-[22px] font-semibold">League History</h1></header>
      {banners.map((h) => <SeasonBanner key={h.year} h={h} />)}
      <p className="text-xs text-muted">Win and loss streaks, and every other manager record, live under <Link to="/records?tab=managers" className="text-accent hover:underline">Records → Managers</Link>.</p>
    </section>
  );
}
