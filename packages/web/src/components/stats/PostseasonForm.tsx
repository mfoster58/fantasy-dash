import type { ManagerRef } from '../../lib/stats/scope';
import type { PostseasonRow } from '../../lib/stats/strength';
import { fmtPpg, fmtSigned } from '../../lib/format';
import Dumbbell from './Dumbbell';
import { Empty } from './StatCard';
import type { Pin } from './pin';

export default function PostseasonForm({ rows, refs, pin }: { rows: PostseasonRow[]; refs: ManagerRef[]; pin: Pin }) {
  if (rows.length === 0) return <Empty text="The playoffs have not started." />;
  const name = (id: string) => refs.find((r) => r.id === id)?.name ?? id;
  const all = rows.flatMap((r) => [r.regPpg, r.postPpg]);
  const lo = Math.floor(Math.min(...all) / 25) * 25, hi = Math.ceil(Math.max(...all) / 25) * 25;
  return (
    <Dumbbell
      rows={rows.map((r) => ({ id: r.id, from: r.regPpg, to: r.postPpg, label: fmtSigned(r.delta, 1), tone: r.delta >= 0 ? 'win' : 'loss', fromTitle: `${name(r.id)}: ${fmtPpg(r.regPpg)} a game in the regular season`, toTitle: `${name(r.id)}: ${fmtPpg(r.postPpg)} a game over ${r.postGames} postseason game${r.postGames === 1 ? '' : 's'}` }))}
      domain={[lo, hi]} ticks={[lo, (lo + hi) / 2, hi]} refs={refs} pin={pin} ariaLabel="Postseason form"
    />
  );
}
