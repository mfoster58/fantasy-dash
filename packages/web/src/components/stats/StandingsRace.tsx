import type { ManagerRef } from '../../lib/stats/scope';
import type { RaceData } from '../../lib/stats/season';
import MultiLine from './MultiLine';
import { Empty } from './StatCard';
import type { Pin } from './pin';

export default function StandingsRace({ data, refs, pin }: { data: RaceData; refs: ManagerRef[]; pin: Pin }) {
  if (data.weeks.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  return (
    <MultiLine
      series={data.series.map((s) => ({ id: s.id, values: s.ranks }))}
      xLabels={data.weeks.map((w) => `wk ${w}`)}
      yDomain={[1, Math.max(2, data.series.length)]}
      invertY
      guides={[{ y: data.playoffTeams + 0.5, label: 'playoff line', tone: 'win' }]}
      rightLabel={(s) => name(s.id)}
      refs={refs} pin={pin} ariaLabel="Standings race"
    />
  );
}
