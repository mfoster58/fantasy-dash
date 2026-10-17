import type { UserId } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import type { ManagerRef } from '../../lib/stats/scope';
import { rowClass, type Pin } from './pin';

/** avatar and name as a row label, gold when active, faded when someone else is */
export default function ManagerName({ id, refs, active, avatar = true }: { id: UserId; refs: ManagerRef[]; active: Pin; avatar?: boolean }) {
  const ref = refs.find((r) => r.id === id);
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 text-xs ${rowClass(id, active)}`}>
      {avatar && <Avatar avatar={ref?.avatar ?? null} name={ref?.name ?? id} size={20} />}
      <span className="truncate">{ref?.name ?? id}</span>
    </span>
  );
}
