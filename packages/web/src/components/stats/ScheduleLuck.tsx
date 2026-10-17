import type { ManagerRef } from '../../lib/stats/scope';
import type { LuckRow } from '../../lib/stats/strength';
import { fmtSigned } from '../../lib/format';
import Dumbbell from './Dumbbell';
import { Empty } from './StatCard';
import type { Pin } from './pin';

export default function ScheduleLuck({ rows, refs, pin }: { rows: LuckRow[]; refs: ManagerRef[]; pin: Pin }) {
  if (rows.length === 0) return <Empty />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const games = Math.max(...rows.map((r) => r.w + r.l + r.t));
  return (
    <Dumbbell
      rows={rows.map((r) => ({ id: r.id, from: r.medianW, to: r.w, label: fmtSigned(r.delta, 0), tone: r.delta >= 0 ? 'win' : 'loss', fromTitle: `${name(r.id)}: ${r.medianW}-${r.medianL} against the weekly median`, toTitle: `${name(r.id)}: ${r.w}-${r.l}${r.t ? `-${r.t}` : ''} for real` }))}
      domain={[0, games]} ticks={[0, Math.round(games / 2), games]} refs={refs} pin={pin} ariaLabel="Schedule luck"
    />
  );
}
