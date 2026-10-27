import type { Field } from '../../lib/live/espn';
import { logoUrl } from '../stats/players/TeamLogo';

const YARD_LINES = [10, 20, 30, 40, 50, 60, 70, 80, 90];

/**
 * The field of a game in progress, away end zone on the left and home on the right, with a line every 10 yards:
 * the drive filled in from the offence's own goal to the ball, the logo of the team with the ball on the spot,
 * and the down and distance underneath.
 */
export default function FieldBar({ field }: { field: Field }) {
  const at = field.yardLine === null ? null : 100 - field.yardLine;
  // the away team attacks the home goal (right), the home team the away goal (left)
  const fill = at === null || !field.possession ? null : field.possession === field.away ? { left: 0, width: at } : { left: at, width: 100 - at };
  const zone = (team: string) => <span className="grid h-4 w-8 shrink-0 place-items-center bg-surface-2 text-[9px] font-bold tracking-wider text-muted">{team}</span>;
  return (
    <div data-testid="field-bar" className="my-1.5">
      <div className="flex items-stretch overflow-visible rounded-sm ring-1 ring-line">
        {zone(field.away)}
        <div className="relative h-4 min-w-24 flex-1 bg-surface">
          {fill && <span aria-hidden="true" className={`absolute inset-y-0 ${field.redZone ? 'bg-loss/35' : 'bg-accent/25'}`} style={{ left: `${fill.left}%`, width: `${fill.width}%` }} />}
          {YARD_LINES.map((y) => <span key={y} data-testid="yard-line" aria-hidden="true" className={`absolute inset-y-0 w-px ${y === 50 ? 'bg-muted/60' : 'bg-line'}`} style={{ left: `${y}%` }} />)}
          {at !== null && (
            <span data-testid="ball" className="absolute top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2" style={{ left: `${at}%` }}>
              {field.possession
                ? <img src={logoUrl(field.possession)} alt={`${field.possession} ball`} className="h-5 w-5 max-w-none rounded-full bg-bg ring-1 ring-ink/40" />
                : <span className="block h-2.5 w-2.5 rounded-full bg-ink" />}
            </span>
          )}
        </div>
        {zone(field.home)}
      </div>
      {field.down && <div className={`mt-1 text-[11px] font-medium ${field.redZone ? 'text-loss' : 'text-ink/80'}`}>{field.down}</div>}
    </div>
  );
}
