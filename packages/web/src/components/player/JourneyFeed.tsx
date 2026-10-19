import Avatar from '../Avatar';
import { FinishIcon, MoveIcon } from '../Icons';
import { ManagerLink, PlayerLink, TeamLink } from '../NameLink';
import PosPill from '../PosPill';
import { history, players } from '../../data/load';
import { stintRange, whenLabel, type Move, type Stint, type TradeSide } from '../../lib/player/journey';
import { playerName } from '../../lib/players';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Each spell on a roster, newest first: who, when, what he did there, and the moves that brought him in and out. */
/** A trade as a swap card: each manager and who they received, with what each player went on to start for them that season. */
function TradeCard({ mv, me }: { mv: Move & { trade: TradeSide[] }; me: string }) {
  return (
    <div data-testid="trade-card" className="mt-1 rounded-lg bg-surface-2 p-2.5">
      <div className="mb-2 flex flex-wrap justify-between gap-2 text-[11px] text-muted">
        <span className="flex items-center gap-1.5"><MoveIcon kind="traded" />Trade · {whenLabel(mv.at)}</span>
        <span>points started for the new team, rest of {mv.at.year}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
        {mv.trade.map((side, i) => {
          const m = history.managers[side.userId];
          const name = m?.displayName ?? side.userId;
          return [
            i > 0 && <span key={`swap-${side.userId}`} aria-hidden="true" className="hidden place-items-center text-muted sm:grid">⇄</span>,
            <div key={side.userId} data-testid="trade-side" className="rounded-md border border-line bg-surface px-2.5 py-2">
              <div className="mb-1.5 flex items-center gap-2 text-sm">
                <Avatar avatar={m?.avatar ?? null} name={name} size={20} />
                <ManagerLink userId={side.userId} className="font-semibold">{name}</ManagerLink>
                <span className="text-muted">received</span>
              </div>
              <ul>
                {side.received.map((r) => {
                  const mine = r.playerId === me;
                  return (
                    <li key={r.playerId} data-me={mine} className={`grid grid-cols-[2.2rem_minmax(0,1fr)_auto] items-center gap-2 rounded px-1 py-0.5 text-sm ${mine ? 'bg-gold/15 shadow-[inset_2px_0_0_var(--gold)]' : ''}`}>
                      <PosPill pos={players[r.playerId]?.position ?? '?'} />
                      <PlayerLink id={r.playerId} className="truncate">{playerName(players, r.playerId)}</PlayerLink>
                      <span className="num text-xs">{r.pts.toFixed(1)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>,
          ];
        })}
      </div>
    </div>
  );
}

export default function JourneyFeed({ stints, seasons, id }: { stints: Stint[]; seasons: number; id: string }) {
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
                    <li key={`${mv.kind}-${mv.at.year}-${mv.at.week}-${mv.created}`} className="border-t border-dashed border-line py-1.5 text-sm first:border-t-0">
                      {mv.trade && mv.trade.length > 1 ? <TradeCard mv={mv as Move & { trade: TradeSide[] }} me={id} /> : (
                        <div className="flex items-center gap-2">
                          <MoveIcon kind={mv.kind} />
                          <span className="min-w-0 flex-1">{mv.text}</span>
                          <span className="whitespace-nowrap text-xs text-muted">{whenLabel(mv.at)}</span>
                        </div>
                      )}
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
