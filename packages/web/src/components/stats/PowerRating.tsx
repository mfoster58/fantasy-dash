import type { ManagerRef } from '../../lib/stats/scope';
import { ELO_CARRY, ELO_K, ELO_MARGIN, ELO_START, type EloHistory } from '../../lib/stats/elo';
import MultiLine from './MultiLine';
import { Empty } from './StatCard';
import type { Pin } from './pin';

export const ELO_ABOUT = `Everyone starts at ${ELO_START}. Before a game the rating gap sets the expected result; afterwards each side moves by up to ${ELO_K} points times how surprising the result was, doubled for a margin of ${ELO_MARGIN} or more. Every game counts, playoffs and consolation included. Between seasons a rating keeps ${Math.round(ELO_CARRY * 100)}% of its distance from ${ELO_START}.`;

export default function PowerRating({ history, refs, pin }: { history: EloHistory; refs: ManagerRef[]; pin: Pin }) {
  if (history.points.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const years = new Set(history.points.map((p) => p.year));
  const xLabels = history.points.map((p) => (years.size > 1 ? (p.week === 1 ? String(p.year) : '') : `wk ${p.week}`));
  const dividers = history.points.map((p, i) => (i > 0 && p.year !== history.points[i - 1].year ? i : -1)).filter((i) => i >= 0);
  const bands = history.points.map((p, i) => (p.playoff ? i : -1)).filter((i) => i >= 0);
  const all = history.series.flatMap((s) => s.ratings).filter((v): v is number => v !== null);
  const lo = Math.min(ELO_START - 50, ...all) - 10, hi = Math.max(ELO_START + 50, ...all) + 10;
  const last = (s: EloHistory['series'][number]) => [...s.ratings].reverse().find((v) => v !== null);
  return (
    <MultiLine
      series={history.series.map((s) => ({ id: s.id, values: s.ratings }))}
      xLabels={xLabels} yDomain={[lo, hi]} guides={[{ y: ELO_START, label: String(ELO_START), tone: 'line' }]} dividers={dividers} bands={bands}
      rightLabel={(s) => { const v = last(history.series.find((x) => x.id === s.id)!); return v === undefined ? name(s.id) : `${name(s.id)} ${Math.round(v)}`; }}
      refs={refs} pin={pin} ariaLabel="Power rating"
    />
  );
}
