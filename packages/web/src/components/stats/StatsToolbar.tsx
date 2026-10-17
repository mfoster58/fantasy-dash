import type { ManagerRef, Scope } from '../../lib/stats/scope';
import Avatar from '../Avatar';
import SeasonPicker from '../SeasonPicker';
import type { Pin } from './pin';

interface Props { years: number[]; season: Scope; onSeason: (s: Scope) => void; refs: ManagerRef[]; pin: Pin; onPin: (id: Pin) => void }

/** Season picker and the pin row: one pill per manager; the pinned one is gold and lights up in every chart. */
export default function StatsToolbar({ years, season, onSeason, refs, pin, onPin }: Props) {
  return (
    <div className="sticky top-12 z-[5] -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-bg/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
      <SeasonPicker years={years} value={season} onChange={onSeason} allTime />
      <div role="group" aria-label="Pin a manager" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5">
        {refs.map((r) => {
          const on = r.id === pin;
          return (
            <button key={r.id} type="button" aria-pressed={on} onClick={() => onPin(on ? null : r.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${on ? 'border-gold bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] text-gold' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>
              <Avatar avatar={r.avatar} name={r.name} size={18} />{r.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
