import { useState } from 'react';
import { Link } from 'react-router';
import type { History, PlayerDirectory } from '@fantasy-dash/core';
import type { BoardDef, BoardRow, Direction } from '../../lib/playerBoards';
import { playerName, playerPos } from '../../lib/players';
import Avatar from '../Avatar';
import Headshot from '../Headshot';
import PosPill from '../PosPill';

interface Props {
  def: BoardDef;
  rows: BoardRow[];
  players: PlayerDirectory;
  managers: History['managers'];
  /** controlled by the section, which expands the boards in the same grid row together */
  expanded: boolean;
  onToggle: () => void;
  direction?: Direction;
  onDirection?: (d: Direction) => void;
  /** current mode id for a board with `def.modes`; defaults to the first mode */
  mode?: string;
  onMode?: (m: string) => void;
  mode2?: string;
  onMode2?: (m: string) => void;
  /** empty-state copy from the definition; falls back to the position copy */
  empty?: string;
}

const PREVIEW = 5;

function Toggle<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <span role="group" aria-label={label} className="flex gap-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${value === o.id ? 'bg-ink text-bg' : 'bg-surface-2 text-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

export default function Board({ def, rows, players, managers, expanded, onToggle, direction = 'desc', onDirection, mode, onMode, mode2, onMode2, empty }: Props) {
  const shown = expanded ? rows : rows.slice(0, PREVIEW);
  // rows whose manager list is opened inline (the hover tooltip never shows on a phone or from the keyboard)
  const [openManagers, setOpenManagers] = useState<Record<string, boolean>>({});
  const managerName = (id: string) => managers[id]?.displayName ?? id;
  const activeMode = def.modes?.find((m) => m.id === mode) ?? def.modes?.[0];
  const activeMode2 = def.modes2?.find((m) => m.id === mode2) ?? def.modes2?.[0];
  const header = (activeMode?.valueHeader ?? def.valueHeader) + (activeMode2?.valueHeader ?? '');
  const [over, under] = def.directionLabels ?? ['Over', 'Under'];
  const directions: { id: Direction; label: string }[] = [{ id: 'desc', label: over }, { id: 'asc', label: under }];
  return (
    <section className="card overflow-hidden" aria-labelledby={`board-${def.id}`}>
      <header className="flex items-start justify-between gap-3 border-b border-line px-3 py-2" title={def.definition}>
        <div className="min-w-0">
          <h3 id={`board-${def.id}`} className="section-label text-ink">{def.title}</h3>
          <p className="mt-0.5 text-xs text-muted">{def.definition}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="section-label">{header}</span>
          {def.sortable && onDirection && <Toggle label="Direction" options={directions} value={direction} onChange={onDirection} />}
          {def.modes && activeMode && onMode && <Toggle label="View" options={def.modes.map((m) => ({ id: m.id, label: m.label }))} value={activeMode.id} onChange={onMode} />}
          {def.modes2 && activeMode2 && onMode2 && <Toggle label="Per game" options={def.modes2.map((m) => ({ id: m.id, label: m.label }))} value={activeMode2.id} onChange={onMode2} />}
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted">{empty ?? (def.tab === 'managers' ? 'Nothing recorded yet.' : 'No players at this position.')}</p>
      ) : (
        <ol className="divide-y divide-line">
          {shown.map((r, i) => {
            const m = r.userId ? managers[r.userId] : undefined;
            const metaNode = r.to
              ? <Link to={r.to} className="num hover:text-accent">{r.meta}</Link>
              : <span className="num">{r.meta}</span>;
            return (
              <li key={r.key} className="flex items-center gap-3 px-3 py-2">
                <span className="num w-4 shrink-0 text-right text-xs text-muted">{i + 1}</span>
                {r.playerId !== null ? <Headshot players={players} id={r.playerId} size={28} /> : <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? r.userId ?? '?'} size={28} />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    {r.playerId !== null ? (
                      <>
                        <PosPill pos={playerPos(players, r.playerId)} />
                        <span className="truncate text-sm font-medium">{playerName(players, r.playerId)}</span>
                      </>
                    ) : (
                      <Link to={`/h2h?a=${r.userId}`} className="truncate text-sm font-medium hover:text-accent">{m?.displayName ?? r.userId}</Link>
                    )}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                    {metaNode}
                    {r.detail && <><span aria-hidden>·</span><span>{r.detail}</span></>}
                    {r.managers && r.managers.length > 1 ? (
                      <>
                        <span aria-hidden>·</span>
                        <button
                          type="button"
                          title={r.managers.map((x) => `${managerName(x.userId)} ${x.weeks} wks`).join(', ')}
                          aria-expanded={openManagers[r.key] ?? false}
                          onClick={() => setOpenManagers((m) => ({ ...m, [r.key]: !m[r.key] }))}
                          className="underline decoration-dotted underline-offset-2 hover:text-ink"
                        >
                          {r.managers.length} managers
                        </button>
                        {openManagers[r.key] && r.managers.map((x) => (
                          <Link key={x.userId} to={`/h2h?a=${x.userId}`} className="flex items-center gap-1 hover:text-accent">
                            <Avatar avatar={managers[x.userId]?.avatar ?? null} name={managerName(x.userId)} size={14} />
                            <span>{managerName(x.userId)} {x.weeks} wks</span>
                          </Link>
                        ))}
                      </>
                    ) : r.playerId !== null && r.userId && (
                      <>
                        <span aria-hidden>·</span>
                        <Link to={`/h2h?a=${r.userId}`} className="flex items-center gap-1 hover:text-accent">
                          <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? r.userId} size={14} />
                          <span>{m?.displayName ?? r.userId}</span>
                        </Link>
                      </>
                    )}
                  </span>
                </span>
                <span className={`num shrink-0 text-base font-semibold ${r.tone === 'win' ? 'text-win' : r.tone === 'loss' ? 'text-loss' : ''}`}>{r.valueLabel}</span>
              </li>
            );
          })}
        </ol>
      )}
      {rows.length > PREVIEW && (
        <button type="button" onClick={onToggle} className="w-full border-t border-line px-3 py-1.5 text-xs text-muted hover:text-ink">
          {expanded ? 'Show less' : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}
