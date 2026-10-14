import type { Week } from '@fantasy-dash/core';

interface Props { weeks: Week[]; selected: number | 'season'; onSelect: (week: number | 'season') => void }

export default function WeekStrip({ weeks, selected, onSelect }: Props) {
  const cls = (active: boolean, extra = '') =>
    `num shrink-0 rounded px-2.5 py-1 text-sm transition-colors ${active ? 'bg-ink text-bg' : 'text-muted hover:bg-surface-2 hover:text-ink'} ${extra}`;
  return (
    <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Week">
      {weeks.map((w) => (
        <button
          key={w.week}
          type="button"
          role="tab"
          aria-selected={selected === w.week}
          onClick={() => onSelect(w.week)}
          title={w.isPlayoff ? 'Playoffs' : undefined}
          className={cls(selected === w.week, `${w.isPlayoff ? 'underline decoration-accent/70 underline-offset-4' : ''} ${w.played ? '' : 'opacity-60'}`)}
        >
          {w.week}
        </button>
      ))}
      <span className="mx-1 w-px self-stretch bg-line" aria-hidden="true" />
      <button type="button" role="tab" aria-selected={selected === 'season'} onClick={() => onSelect('season')} className={cls(selected === 'season')}>
        Season
      </button>
    </div>
  );
}
