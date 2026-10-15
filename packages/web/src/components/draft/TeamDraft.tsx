import type { Draft, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { fmtPts, fmtSigned } from '../../lib/format';
import { playerName, playerPos, playerTeam } from '../../lib/players';
import { letterGrade, managerDraftSummaries, pickLabel } from '../../lib/draft';

interface Props {
  draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory;
  userId: UserId; onSelect: (userId: UserId) => void; inSeason: boolean;
}

const signClass = (n: number | null) => (n === null || n === 0 ? 'text-muted' : n > 0 ? 'text-win' : 'text-loss');
/** Picks at or beyond this |value| get a colored edge, like the example board's standout rows. */
const STANDOUT = 40;

/** One manager's draft, round by round. Cycles with the board's column headers, the grade list, or the arrows here. */
export default function TeamDraft({ draft, managers, players, userId, onSelect, inSeason }: Props) {
  const order = draft.slotOrder;
  const teams = order.length;
  const idx = Math.max(0, order.indexOf(userId));
  const prev = order[(idx - 1 + teams) % teams];
  const next = order[(idx + 1) % teams];
  const m = managers[userId];
  const picks = draft.picks.filter((p) => p.userId === userId).sort((a, b) => a.pickNo - b.pickNo);
  const summaries = managerDraftSummaries(draft);
  const rank = summaries.findIndex((s) => s.userId === userId) + 1;
  const summary = rank > 0 ? summaries[rank - 1] : null;

  return (
    <div className="card" data-testid="team-draft">
      <div className="flex items-center gap-2 border-b border-line px-3 pb-2 pt-3">
        <button type="button" aria-label="Previous manager" onClick={() => onSelect(prev)} className="rounded px-2 py-1 text-muted hover:bg-surface-2 hover:text-ink">‹</button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={28} />
          <div className="min-w-0">
            <div className="section-label">{rank > 0 ? `${rank} of ${summaries.length}` : `slot ${idx + 1}`}{inSeason ? ' · to date' : ''}</div>
            <div className="truncate text-sm font-semibold uppercase tracking-wide">{m?.displayName ?? userId}</div>
          </div>
        </div>
        {rank > 0 && <span className="text-2xl font-bold">{letterGrade(rank, summaries.length)}</span>}
        <button type="button" aria-label="Next manager" onClick={() => onSelect(next)} className="rounded px-2 py-1 text-muted hover:bg-surface-2 hover:text-ink">›</button>
      </div>
      {summary && (
        <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
          {[
            ['Draft value', summary.totalValue, `capital earned minus spent over ${summary.valued} pick${summary.valued === 1 ? '' : 's'}`],
            [`${summary.beat} hit${summary.beat === 1 ? '' : 's'}`, summary.hits, 'from picks that beat their slot'],
            [`${summary.valued - summary.beat} miss${summary.valued - summary.beat === 1 ? '' : 'es'}`, summary.misses, 'from picks that fell short'],
          ].map(([label, n, sub]) => (
            <div key={label as string} className="px-3 py-2">
              <div className="section-label">{label as string}</div>
              <div className={`num text-lg font-bold ${signClass(n as number)}`}>{fmtSigned(n as number, 0)}</div>
              <div className="truncate text-[10px] text-muted">{sub as string}</div>
            </div>
          ))}
        </div>
      )}
      <ol>
        {picks.map((p) => {
          const pos = playerPos(players, p.playerId);
          const owner = p.tradedTo ? managers[p.tradedTo.userId]?.displayName ?? p.tradedTo.userId : null;
          const edge = p.value === null ? 'border-l-transparent' : p.value >= STANDOUT ? 'border-l-win' : p.value <= -STANDOUT ? 'border-l-loss' : 'border-l-transparent';
          return (
            <li key={p.pickNo} className={`grid grid-cols-[2.25rem_26px_minmax(0,1fr)_3.5rem_3rem] items-center gap-2 border-t border-l-2 border-line px-3 py-1.5 text-sm first:border-t-0 ${edge}`}>
              <span className="num text-xs text-muted">{pickLabel(p, teams)}</span>
              <Headshot players={players} id={p.playerId} size={26} />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{playerName(players, p.playerId)}</span>
                  <PosPill pos={pos} />
                  {p.isKeeper && <span className="rounded bg-surface-2 px-1 text-[9px] font-semibold uppercase tracking-wide text-muted">kept</span>}
                </span>
                <span className="block truncate text-xs text-muted">
                  {playerTeam(players, p.playerId)}{p.redraftPos !== null ? ` · redraft ${p.redraftPos}` : ''}{owner ? ` · traded to ${owner}` : ''}
                </span>
              </span>
              <span className="num text-right text-xs text-muted">{fmtPts(p.seasonPoints)}</span>
              <span className={`num text-right text-base font-semibold ${signClass(p.value)}`}>{p.value === null ? '—' : fmtSigned(p.value, 0)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
