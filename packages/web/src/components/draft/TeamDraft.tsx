import type { Draft, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import Avatar from '../Avatar';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { fmtPts, fmtSigned } from '../../lib/format';
import { playerName, playerPos, playerTeam } from '../../lib/players';
import { managerDraftSummaries } from '../../lib/draft';

interface Props {
  draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory;
  userId: UserId; onSelect: (userId: UserId) => void; inSeason: boolean;
}

const signClass = (n: number | null) => (n === null || n === 0 ? 'text-muted' : n > 0 ? 'text-win' : 'text-loss');

/** One manager's draft, round by round. Cycles with the board's column headers or the arrows here. */
export default function TeamDraft({ draft, managers, players, userId, onSelect, inSeason }: Props) {
  const order = draft.slotOrder;
  const idx = Math.max(0, order.indexOf(userId));
  const prev = order[(idx - 1 + order.length) % order.length];
  const next = order[(idx + 1) % order.length];
  const m = managers[userId];
  const picks = draft.picks.filter((p) => p.userId === userId).sort((a, b) => a.pickNo - b.pickNo);
  const summaries = managerDraftSummaries(draft);
  const rank = summaries.findIndex((s) => s.userId === userId) + 1;
  const summary = summaries[rank - 1];

  return (
    <div className="card" data-testid="team-draft">
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <button type="button" aria-label="Previous manager" onClick={() => onSelect(prev)} className="rounded px-2 py-1 text-muted hover:bg-surface-2 hover:text-ink">‹</button>
        <div className="flex min-w-0 items-center gap-2">
          <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={26} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{m?.displayName ?? userId}</div>
            <div className="text-xs text-muted">slot {idx + 1}{rank > 0 ? ` · grade ${rank} of ${summaries.length}` : ''}{inSeason ? ' · to date' : ''}</div>
          </div>
        </div>
        <button type="button" aria-label="Next manager" onClick={() => onSelect(next)} className="rounded px-2 py-1 text-muted hover:bg-surface-2 hover:text-ink">›</button>
      </div>
      {summary && (
        <div className="grid grid-cols-4 gap-2 px-4 py-3 text-center">
          {[['Value', summary.totalValue, 0], ['Slot', summary.totalSlot, 0], ['Production', summary.totalProduction, 0], ['Pts over base', summary.totalPoB, 1]].map(([label, n, d]) => (
            <div key={label as string}>
              <div className="section-label">{label as string}</div>
              <div className={`num text-sm font-semibold ${signClass(n as number)}`}>{fmtSigned(n as number, d as number)}</div>
            </div>
          ))}
        </div>
      )}
      <ol className="border-t border-line">
        {picks.map((p) => {
          const pos = playerPos(players, p.playerId);
          const owner = p.tradedTo ? managers[p.tradedTo.userId]?.displayName ?? p.tradedTo.userId : null;
          return (
            <li key={p.pickNo} className="grid grid-cols-[1.5rem_24px_minmax(0,1fr)_3.5rem_3rem] items-center gap-2 border-t border-line px-3 py-1.5 text-sm first:border-t-0">
              <span className="num text-xs text-muted">{p.round}</span>
              <Headshot players={players} id={p.playerId} size={24} />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-medium">{playerName(players, p.playerId)}</span>
                  <PosPill pos={pos} />
                  {p.isKeeper && <span className="text-[10px] uppercase tracking-wide text-accent">K</span>}
                </span>
                <span className="block truncate text-xs text-muted">
                  {playerTeam(players, p.playerId)} · pick {p.pickNo}{p.redraftPos !== null ? ` → redraft ${p.redraftPos}` : ''}{owner ? ` · to ${owner}` : ''}
                </span>
              </span>
              <span className="num text-right text-xs text-muted">{fmtPts(p.seasonPoints)}</span>
              <span className={`num text-right font-semibold ${signClass(p.value)}`}>{p.value === null ? '—' : fmtSigned(p.value, 0)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
