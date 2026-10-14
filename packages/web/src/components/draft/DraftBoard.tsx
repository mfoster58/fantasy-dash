import type { Draft, DraftPick, Manager, PlayerDirectory, UserId } from '@fantasy-dash/core';
import { fmtPts, fmtSigned } from '../../lib/format';
import { playerName, playerPos, playerTeam, posColor } from '../../lib/players';
import { posLabel, valueColor } from '../../lib/draft';

export type BoardMode = 'position' | 'value';

interface Props {
  draft: Draft; managers: Record<UserId, Manager>; players: PlayerDirectory;
  mode: BoardMode; highlight: UserId | null; onHighlight: (userId: UserId | null) => void; inSeason: boolean;
}

function cellTitle(p: DraftPick, players: PlayerDirectory, inSeason: boolean): string {
  const pos = playerPos(players, p.playerId);
  const suffix = inSeason ? ' to date' : '';
  const lines = [`${playerName(players, p.playerId)} · ${pos} · ${playerTeam(players, p.playerId)}`, `Pick ${p.pickNo} (round ${p.round})`,
    `Season points${suffix}: ${fmtPts(p.seasonPoints)}`];
  if (p.posFinishRank !== null) lines.push(`Finished ${pos}${p.posFinishRank}${suffix} · drafted ${posLabel(pos, p.posDraftRank)}`);
  if (p.value !== null) lines.push(`Value: ${fmtSigned(p.value, 0)} ranks`);
  if (p.pointsOverBaseline !== null) lines.push(`Points over baseline: ${fmtSigned(p.pointsOverBaseline, 2)}`);
  if (p.isKeeper) lines.push('Keeper');
  return lines.join('\n');
}

export default function DraftBoard({ draft, managers, players, mode, highlight, onHighlight, inSeason }: Props) {
  const slots = draft.slotOrder.length;
  const bySlot = new Map<string, DraftPick>();
  for (const p of draft.picks) bySlot.set(`${p.round}-${p.slot}`, p);
  const rounds = Array.from({ length: draft.rounds }, (_, i) => i + 1);

  return (
    <div className="card overflow-x-auto">
      <div className="min-w-[960px]">
        <div className="grid border-b border-line" style={{ gridTemplateColumns: `3rem repeat(${slots}, minmax(0, 1fr))` }}>
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
          <div key={round} className="grid border-t border-line" style={{ gridTemplateColumns: `3rem repeat(${slots}, minmax(0, 1fr))` }}>
            <div className="num flex items-center justify-center text-xs text-muted">{round}</div>
            {draft.slotOrder.map((_, i) => {
              const slot = i + 1;
              const p = bySlot.get(`${round}-${slot}`);
              if (!p) return <div key={slot} className="h-14 border-l border-line" />;
              const pos = playerPos(players, p.playerId);
              const isHl = highlight !== null && p.userId === highlight;
              const dim = highlight !== null && !isHl;
              const background = mode === 'position' ? `color-mix(in srgb, ${posColor(pos)} 16%, transparent)` : valueColor(p.value);
              return (
                <div
                  key={slot}
                  data-testid="draft-cell"
                  data-highlight={isHl ? 'true' : 'false'}
                  title={cellTitle(p, players, inSeason)}
                  style={{ background }}
                  className={`flex h-14 flex-col justify-center border-l border-line px-2 text-xs transition-opacity ${dim ? 'opacity-35' : ''} ${isHl ? 'ring-1 ring-inset ring-accent' : ''}`}
                >
                  <div className="truncate font-medium">{playerName(players, p.playerId)}</div>
                  <div className={`flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px] ${mode === 'value' ? 'text-ink' : 'text-muted'}`}>
                    <span className="font-semibold" style={mode === 'position' ? { color: posColor(pos) } : undefined}>{posLabel(pos, p.posDraftRank)}</span>
                    <span className={mode === 'value' ? 'opacity-75' : ''}>{playerTeam(players, p.playerId)}</span>
                    {mode === 'value'
                      ? <>
                          {p.isKeeper && <span className="rounded bg-surface-2 px-1 text-[10px] font-semibold">K</span>}
                          {p.value !== null && <span className="num ml-auto">{fmtSigned(p.value, 0)}</span>}
                        </>
                      : p.isKeeper && <span className="ml-auto rounded bg-surface-2 px-1 text-[10px] uppercase tracking-wide">Keeper</span>}
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
