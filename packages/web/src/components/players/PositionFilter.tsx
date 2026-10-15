import { POS_FILTERS, type PosFilter } from '../../lib/playerLines';

interface Props { value: PosFilter; onChange: (p: PosFilter) => void }

/** One row of toggle buttons. The chosen position narrows every board on the page. */
export default function PositionFilter({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="Position" className="flex flex-wrap gap-1">
      {POS_FILTERS.map((p) => {
        const on = p === value;
        return (
          <button
            key={p}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(p)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${on ? 'bg-ink text-bg' : 'bg-surface-2 text-muted hover:text-ink'}`}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}
