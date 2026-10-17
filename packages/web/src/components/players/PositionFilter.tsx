import { POS_FILTERS, type PosFilter } from '../../lib/playerLines';

interface Props { value: PosFilter; onChange: (p: PosFilter) => void; /** `sm` is the bar inside a board card */ size?: 'md' | 'sm' }

const SIZES = {
  md: { wrap: 'gap-1', pill: 'rounded-full px-3 py-1 text-xs' },
  sm: { wrap: 'gap-0.5', pill: 'rounded px-1.5 py-0.5 text-[10px]' },
};

/** One row of toggle buttons. At the top of a section the chosen position narrows every board; inside a card, that board alone. */
export default function PositionFilter({ value, onChange, size = 'md' }: Props) {
  const s = SIZES[size];
  return (
    <div role="group" aria-label="Position" className={`flex flex-wrap ${s.wrap}`}>
      {POS_FILTERS.map((p) => {
        const on = p === value;
        return (
          <button
            key={p}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(p)}
            className={`${s.pill} font-medium transition-colors ${on ? 'bg-ink text-bg' : 'bg-surface-2 text-muted hover:text-ink'}`}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}
