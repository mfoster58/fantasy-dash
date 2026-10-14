import { useEffect, useRef } from 'react';
import type { Week } from '@fantasy-dash/core';

interface Props { weeks: Week[]; selected: number; onSelect: (week: number) => void }

export default function WeekStrip({ weeks, selected, onSelect }: Props) {
  const cls = (active: boolean, extra = '') =>
    `num shrink-0 rounded px-2.5 py-1 text-sm transition-colors ${active ? 'bg-ink text-bg' : 'text-muted hover:bg-surface-2 hover:text-ink'} ${extra}`;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Keep the selected week in view when the strip scrolls on narrow screens.
    const el = ref.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [selected]);
  return (
    <div ref={ref} className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Week">
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
    </div>
  );
}
