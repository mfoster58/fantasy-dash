import type { Draft, DraftPick, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import { fmtPpg, fmtPts, fmtSigned } from '../../lib/format';
import { playerName, playerPos, playerTeam, posColor } from '../../lib/players';
import { posLabel, valueColor } from '../../lib/draft';

export type BoardMode = 'position' | 'value';

interface Props {
  draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory;
  mode: BoardMode; highlight: UserId | null; onHighlight: (userId: UserId | null) => void; inSeason: boolean;
}

function cellTitle(p: DraftPick, players: PlayerDirectory, managers: Record<UserId, Manager>, inSeason: boolean): string {
  const pos = playerPos(players, p.playerId);
  const suffix = inSeason ? ' to date' : '';
  const lines = [
    `${playerName(players, p.playerId)} · ${pos} · ${playerTeam(players, p.playerId)}`,
    `Pick ${p.pickNo} (round ${p.round})`,
    `Season points${suffix}: ${fmtPts(p.seasonPoints)}`,
  ];
  if (p.redraftPos !== null) lines.push(`Redraft position${inSeason ? ' today' : ''}: ${p.redraftPos} (drafted ${posLabel(pos, p.posDraftRank)})`);
  if (p.slotValue !== null && p.productionValue !== null) lines.push(`Slot value: ${fmtSigned(p.slotValue, 1)} · Production value: ${fmtSigned(p.productionValue, 1)}`);
  if (p.pointsOverBaseline !== null) lines.push(`Points over baseline: ${fmtSigned(p.pointsOverBaseline, 2)}`);
  if (p.ppg !== null) lines.push(`PPG: ${fmtPpg(p.ppg)} over ${p.gamesPlayed} game${p.gamesPlayed === 1 ? '' : 's'}`);
  if (p.isKeeper) lines.push('Keeper');
  if (p.tradedTo) lines.push(`Traded to ${managers[p.tradedTo.userId]?.displayName ?? p.tradedTo.userId} in week ${p.tradedTo.week}`);
  return lines.join('\n');
}

const LockIcon = () => (
  <svg aria-label="Keeper" role="img" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const SwapIcon = () => (
  <svg aria-label="Traded" role="img" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-warn">
    <path d="M4 7h13l-3-3" />
    <path d="M20 17H7l3 3" />
  </svg>
);


export default function DraftBoard({ draft, managers, players, mode, highlight, onHighlight, inSeason }: Props) {
  const slots = draft.slotOrder.length;
  const cols = `3rem repeat(${slots}, minmax(0, 1fr))`;
  const bySlot = new Map<string, DraftPick>();
  for (const p of draft.picks) bySlot.set(`${p.round}-${p.slot}`, p);
  const rounds = Array.from({ length: draft.rounds }, (_, i) => i + 1);

  return (
    <div className="card overflow-x-auto">
      <div className="min-w-[960px]">
        <div className="grid border-b border-line" style={{ gridTemplateColumns: cols }}>
          <div />
          {draft.slotOrder.map((userId, i) => {
            const m = managers[userId];
            const active = highlight === userId;
            return (
              <button
                key={userId}
                type="button"
                onClick={() => onHighlight(active ? null : userId)}
                aria-pressed={active}
                className={`truncate px-2 py-2 text-left text-xs transition-colors ${active ? 'bg-surface-2 text-ink' : 'text-muted hover:text-ink'}`}
                title={`${m?.teamName ?? ''} · slot ${i + 1}`}
              >
                {m?.displayName ?? userId}
              </button>
            );
          })}
        </div>
        {rounds.map((round) => (
          <div key={round} className="grid border-t border-line" style={{ gridTemplateColumns: cols }}>
            <div className="num flex items-center justify-center text-xs text-muted">{round}</div>
            {draft.slotOrder.map((_, i) => {
              const slot = i + 1;
              const p = bySlot.get(`${round}-${slot}`);
              if (!p) return <div key={slot} className="h-14 border-l border-line" />;
              const pos = playerPos(players, p.playerId);
              const isHl = highlight !== null && p.userId === highlight;
              const dim = highlight !== null && !isHl;
              const background = mode === 'position' ? `color-mix(in srgb, ${posColor(pos)} 16%, transparent)` : valueColor(p.value);
              const ring = isHl ? 'ring-1 ring-inset ring-accent' : p.tradedTo ? 'ring-1 ring-inset ring-warn' : p.isKeeper ? 'ring-1 ring-inset ring-accent/60' : '';
              return (
                <div
                  key={slot}
                  data-testid="draft-cell"
                  data-highlight={isHl ? 'true' : 'false'}
                  title={cellTitle(p, players, managers, inSeason)}
                  style={{ background }}
                  className={`relative flex h-14 flex-col justify-center border-l border-line px-2 text-xs transition-opacity ${dim ? 'opacity-35' : ''} ${ring}`}
                >
                  {(p.isKeeper || p.tradedTo) && (
                    <span className="absolute right-1 top-1 flex items-center gap-1">
                      {p.tradedTo && <SwapIcon />}
                      {p.isKeeper && <LockIcon />}
                    </span>
                  )}
                  <div className="truncate pr-5 font-medium">{playerName(players, p.playerId)}</div>
                  <div className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px] text-muted">
                    <span className="font-semibold" style={mode === 'position' ? { color: posColor(pos) } : undefined}>{posLabel(pos, p.posDraftRank)}</span>
                    {p.tradedTo
                      ? <span className="truncate font-medium text-warn" title={`Traded to ${managers[p.tradedTo.userId]?.displayName ?? p.tradedTo.userId} in week ${p.tradedTo.week}`}>{managers[p.tradedTo.userId]?.displayName ?? p.tradedTo.userId}</span>
                      : <span>{playerTeam(players, p.playerId)}</span>}
                    {mode === 'value' && p.value !== null && <span className="num ml-auto shrink-0 font-semibold text-ink">{fmtSigned(p.value, 0)}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
