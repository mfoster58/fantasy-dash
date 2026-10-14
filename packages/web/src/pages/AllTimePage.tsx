import { useMemo } from 'react';
import AllTimeRecords from '../components/AllTimeRecords';
import AllTimeTable from '../components/AllTimeTable';
import { history } from '../data/load';
import { allTimeRecords } from '../lib/allTimeRecords';

export default function AllTimePage() {
  const first = history.seasons[0]?.year;
  const last = history.seasons[history.seasons.length - 1]?.year;
  const records = useMemo(() => allTimeRecords(history.h2h), []);
  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-[22px] font-semibold">All-Time <span className="num font-normal text-muted">{first} to {last}</span></h1>
      </header>
      <AllTimeTable rows={history.allTime} managers={history.managers} />
      <p className="text-xs text-muted">Regular season records across every season. Streak carries across seasons. Click a manager to open their head-to-head history.</p>
      <AllTimeRecords records={records} managers={history.managers} />
      <p className="text-xs text-muted">Single-game records across every played game, playoffs included. Click a row to open the box score.</p>
    </section>
  );
}
