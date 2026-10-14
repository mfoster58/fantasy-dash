import { history } from '../data/load';

export default function HomePage() {
  return (
    <section className="space-y-2">
      <h1 className="text-xl font-semibold">Seasons</h1>
      <ul className="space-y-1 text-sm">
        {history.seasons.map((s) => (
          <li key={s.year} className="num">{s.year} <span className="text-muted">{s.status === 'complete' ? 'final' : `through week ${s.lastScoredWeek}`}</span></li>
        ))}
      </ul>
    </section>
  );
}
