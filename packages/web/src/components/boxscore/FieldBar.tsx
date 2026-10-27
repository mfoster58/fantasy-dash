import type { Field } from '../../lib/live/espn';
import { logoUrl } from '../stats/players/TeamLogo';

/**
 * The field of a game in progress, away end zone on the left and home on the right: the drive filled in
 * from the offence's own goal to the ball, and the logo of the team with the ball on the spot.
 */
export default function FieldBar({ field }: { field: Field }) {
  const at = field.yardLine === null ? null : 100 - field.yardLine;
  // the away team attacks the home goal (right), the home team the away goal (left)
  const fill = at === null || !field.possession ? null : field.possession === field.away ? { left: 0, width: at } : { left: at, width: 100 - at };
  return (
    <div data-testid="field-bar" className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
      <span className="shrink-0 font-semibold">{field.away}</span>
      <div className="relative h-1.5 min-w-16 flex-1 rounded-full bg-surface-2">
        <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-line" />
        {fill && <span aria-hidden="true" className={`absolute inset-y-0 rounded-full ${field.redZone ? 'bg-loss/60' : 'bg-accent/50'}`} style={{ left: `${fill.left}%`, width: `${fill.width}%` }} />}
        {at !== null && (
          <span data-testid="ball" className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${at}%` }}>
            {field.possession
              ? <img src={logoUrl(field.possession)} alt={`${field.possession} ball`} className="h-4 w-4 max-w-none rounded-full bg-bg ring-1 ring-line" />
              : <span className="block h-2 w-2 rounded-full bg-ink" />}
          </span>
        )}
      </div>
      <span className="shrink-0 font-semibold">{field.home}</span>
      {field.down && <span className={`shrink-0 ${field.redZone ? 'text-loss' : ''}`}>{field.down}</span>}
    </div>
  );
}
