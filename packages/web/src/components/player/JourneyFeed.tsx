import Avatar from '../Avatar';
import { FinishIcon, MoveIcon } from '../Icons';
import { ManagerLink, TeamLink } from '../NameLink';
import { history } from '../../data/load';
import { stintRange, whenLabel, type Stint } from '../../lib/player/journey';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Each spell on a roster, newest first: who, when, what he did there, and the moves that brought him in and out. */
export default function JourneyFeed({ stints, seasons }: { stints: Stint[]; seasons: number }) {
  const managers = new Set(stints.map((s) => s.userId)).size;
  const moves = stints.reduce((n, s) => n + s.moves.length, 0);
  return (
    <section aria-labelledby="pp-path" className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 pb-2 pt-3">
        <h2 id="pp-path" className="text-sm font-semibold uppercase tracking-wide">Path through the league</h2>
        <span className="text-xs text-muted">{plural(managers, 'manager')} · {plural(seasons, 'season')} · {plural(moves, 'move')}</span>
      </div>
      <ol className="divide-y divide-line">
        {stints.map((s) => {
          const m = history.managers[s.userId];
          const name = m?.displayName ?? s.userId;
          return (
            <li key={`${s.userId}-${s.from.year}-${s.from.week}`} data-testid="stint" className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Avatar avatar={m?.avatar ?? null} name={name} size={22} />
                <ManagerLink userId={s.userId} className="font-semibold">{name}</ManagerLink>
                {s.teamName !== name && <TeamLink userId={s.userId} year={s.lastYear} className="text-sm text-muted">{s.teamName}</TeamLink>}
                {s.title && <FinishIcon kind="champion" size="1em" />}
                <span className="ml-auto text-xs text-muted">{stintRange(s)}</span>
              </div>
              <div className="num ml-8 mt-1 flex flex-wrap gap-x-4 text-xs text-muted">
                <span><b className="font-semibold text-ink">{s.starts}</b> starts</span>
                <span><b className="font-semibold text-ink">{s.pts.toFixed(1)}</b> pts</span>
                {s.perStart !== null && <span><b className="font-semibold text-ink">{s.perStart.toFixed(1)}</b> / start</span>}
                <span><b className="font-semibold text-ink">{s.w}–{s.l}{s.t ? `–${s.t}` : ''}</b> started</span>
              </div>
              {s.moves.length > 0 && (
                <ul className="ml-8 mt-2">
                  {s.moves.map((mv) => (
                    <li key={`${mv.kind}-${mv.at.year}-${mv.at.week}-${mv.created}`} className="flex items-center gap-2 border-t border-dashed border-line py-1.5 text-sm first:border-t-0">
                      <MoveIcon kind={mv.kind} />
                      <span className="min-w-0 flex-1">{mv.text}</span>
                      <span className="whitespace-nowrap text-xs text-muted">{whenLabel(mv.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
