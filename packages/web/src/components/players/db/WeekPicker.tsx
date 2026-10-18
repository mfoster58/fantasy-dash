import { Fragment, useEffect, useState } from 'react';

interface Props {
  from: number;
  to: number;
  /** last week with data; later weeks show greyed */
  throughWeek: number;
  /** the season's last week, so the row keeps its length all year */
  lastWeek: number;
  /** first fantasy playoff week: a dashed gap is drawn before it */
  playoffAt: number | null;
  onChange: (range: { from: number; to: number }) => void;
}

type Mode = 'week' | 'range';
const pill = (on: boolean) => `rounded-full px-3 py-1 text-xs font-medium transition-colors ${on ? 'bg-ink text-bg' : 'bg-surface-2 text-muted hover:text-ink'}`;

/**
 * One bubble per week. Week mode: a tap picks that week. Range mode: the first tap sets one end, the second the other,
 * with a hint saying which is next. The selection draws as one joined band.
 */
export default function WeekPicker({ from, to, throughWeek, lastWeek, playoffAt, onChange }: Props) {
  const max = Math.max(1, throughWeek);
  const [mode, setMode] = useState<Mode>(from !== to ? 'range' : 'week');
  const [anchor, setAnchor] = useState<number | null>(null);
  // a range arriving from the URL or a shortcut always shows as Range
  useEffect(() => { if (from !== to) setMode('range'); setAnchor(null); }, [from, to]);

  const tap = (w: number) => {
    if (mode === 'week') { onChange({ from: w, to: w }); return; }
    if (anchor === null) { setAnchor(w); return; }
    onChange({ from: Math.min(anchor, w), to: Math.max(anchor, w) });
    setAnchor(null);
  };
  const toWeek = () => { setMode('week'); setAnchor(null); if (from !== to) onChange({ from: to, to }); };
  const toRange = () => { setMode('range'); setAnchor(null); };
  const preset = (f: number) => { setMode('range'); setAnchor(null); onChange({ from: f, to: max }); };

  // while picking the second end, the band previews just the first
  const lo = anchor ?? from, hi = anchor ?? to;
  const inBand = (w: number) => w >= lo && w <= hi;
  const weeks = Array.from({ length: Math.max(lastWeek, max) }, (_, i) => i + 1);
  const hint = mode === 'range' ? (anchor === null ? 'Tap the first week' : 'Tap the last week') : null;
  const last4 = Math.max(1, max - 3);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <div role="group" aria-label="Pick" className="flex gap-1">
        <button type="button" aria-pressed={mode === 'week'} onClick={toWeek} className={pill(mode === 'week')}>Week</button>
        <button type="button" aria-pressed={mode === 'range'} onClick={toRange} className={pill(mode === 'range')}>Range</button>
      </div>
      <div role="group" aria-label="Weeks" className="-my-1 flex max-w-full items-center overflow-x-auto py-1">
        {weeks.map((w) => {
          const on = inBand(w), played = w <= max;
          const end = w === lo || w === hi;
          const band = on ? `bg-accent/20 ${w === lo ? 'rounded-l-full' : ''} ${w === hi ? 'rounded-r-full' : ''}` : '';
          const face = !played ? 'text-muted/40 cursor-default'
            : end && on ? 'bg-accent text-bg font-semibold'
              : on ? 'text-ink font-medium hover:bg-accent/30'
                : 'text-muted hover:bg-surface-2 hover:text-ink';
          return (
            <Fragment key={w}>
              {playoffAt !== null && w === playoffAt && w > 1 && (
                <span data-testid="playoff-gap" title="Fantasy playoffs from here" className={`flex h-7 w-3 shrink-0 justify-center ${on && lo < w ? 'bg-accent/20' : ''}`}>
                  <span className="h-full border-l border-dashed border-muted/60" />
                </span>
              )}
              <span className={`flex shrink-0 ${band}`}>
                <button type="button" aria-label={`Week ${w}`} aria-pressed={!!(on && played && anchor === null) || w === anchor} disabled={!played} onClick={() => tap(w)}
                  className={`num h-7 w-7 rounded-full text-xs transition-colors ${face}`}>{w}</button>
              </span>
            </Fragment>
          );
        })}
      </div>
      <div className="flex items-center gap-1">
        <button type="button" aria-pressed={from === last4 && to === max} onClick={() => preset(last4)} className={pill(from === last4 && to === max)}>Last 4</button>
        <button type="button" aria-pressed={from === 1 && to === max} onClick={() => preset(1)} className={pill(from === 1 && to === max)}>Season</button>
      </div>
      {hint && <span aria-live="polite" className="text-xs text-muted">{hint}</span>}
    </div>
  );
}
