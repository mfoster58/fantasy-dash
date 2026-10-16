import { Link } from 'react-router';
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPct, fmtPts } from '../../lib/format';
import type { TeamGame } from '../../lib/managerGames';
import type { LineupDesk } from '../../lib/teamProfile';

const link = (g: TeamGame) => `/scores/${g.year}/${g.week}/${g.matchupId}`;

function Moment({ label, game, value, note }: { label: string; game: TeamGame | null; value: string; note: string }) {
  if (!game) return null;
  return (
    <Link to={link(game)} className="block rounded-md border border-line px-3 py-2 hover:bg-surface-2">
      <span className="section-label text-[10px]">{label} <span className="num normal-case tracking-normal text-muted">{game.year} W{game.week}</span></span>
      <span className="num mt-0.5 block text-lg font-semibold leading-tight">{value}</span>
      <span className="block text-xs text-muted">{note}</span>
    </Link>
  );
}

/** Career lineup efficiency with the best-set week and the one that got away. */
export default function LineupDeskCard({ desk }: { desk: LineupDesk }) {
  return (
    <section className="card p-4">
      <CardHeader title="Lineup success" aside={`${desk.weeks} weeks`} />
      <div className="mt-3 flex items-baseline gap-3">
        <span className="num text-3xl font-semibold">{fmtPct(desk.efficiency)}</span>
        <span className="text-xs text-muted">efficiency · <span className="num">{fmtPts(desk.started)}</span> started of <span className="num">{fmtPts(desk.possible)}</span> · <span className="num">{fmtPts(desk.benchLeft)}</span> left on the bench</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-surface-2"><div className="h-full rounded" style={{ width: fmtPct(Math.min(1, desk.efficiency), 0), background: 'color-mix(in srgb, var(--accent) 65%, transparent)' }} /></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Moment label="Best-set week" game={desk.best} value={desk.best ? `${fmtPts(desk.best.points)} of ${fmtPts(desk.best.ceiling)}` : ''} note={desk.best ? fmtPct(desk.best.points / desk.best.ceiling) : ''} />
        <Moment label="The one that got away" game={desk.worst} value={desk.worst ? `${fmtPts(desk.worst.points)} of ${fmtPts(desk.worst.ceiling)}` : ''} note={desk.worst ? `${fmtPts(desk.worst.benchPoints)} left on the bench` : ''} />
      </div>
    </section>
  );
}
