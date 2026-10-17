import { useState } from 'react';
import { Link } from 'react-router';
import type { History, PlayerDirectory } from '@fantasy-dash/core';
import type { BoardDef, BoardRow, Direction } from '../../lib/playerBoards';
import type { PosFilter } from '../../lib/playerLines';
import { playerName, playerPos } from '../../lib/players';
import Avatar from '../Avatar';
import Headshot from '../Headshot';
import { CrownIcon } from '../Icons';
import PosPill from '../PosPill';
import PositionFilter from './PositionFilter';

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
  /** this board's own position; the bar shows only when the section controls it */
  position?: PosFilter;
  onPosition?: (p: PosFilter) => void;
  /** empty-state copy from the definition; falls back to the position copy */
  empty?: string;
}

const PREVIEW = 5;
const MAX_CROWNS = 3;
const RECORD_ROW = 'bg-[color-mix(in_srgb,var(--gold)_10%,transparent)]';

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

/**
 * The ? button beside a board title. The definition shows while the button is hovered or focused, and a press pins it until
 * the next press, Escape or blur. A press clears the hover flag, so a phone tap (mouseenter then click, never a mouseleave)
 * opens on the first tap and closes on the second. The panel itself is rendered by the board, in the flow of the header,
 * so the card's clipped overflow can never cut it off.
 */
function useAbout(): { open: boolean; buttonProps: Record<string, unknown> } {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const open = pinned || hover;
  return {
    open,
    buttonProps: {
      onClick: () => { setPinned((p) => !p); setHover(false); },
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      onFocus: () => setHover(true),
      onBlur: () => { setHover(false); setPinned(false); },
      onKeyDown: (e: { key: string }) => { if (e.key === 'Escape') { setHover(false); setPinned(false); } },
    },
  };
}

export default function Board({ def, rows, players, managers, expanded, onToggle, direction = 'desc', onDirection, mode, onMode, mode2, onMode2, position, onPosition, empty }: Props) {
  const shown = expanded ? rows : rows.slice(0, PREVIEW);
  // rows whose manager list is opened inline (the hover tooltip never shows on a phone or from the keyboard)
  const [openManagers, setOpenManagers] = useState<Record<string, boolean>>({});
  const about = useAbout();
  const aboutId = `about-${def.id}`;
  const managerName = (id: string) => managers[id]?.displayName ?? id;
  const activeMode = def.modes?.find((m) => m.id === mode) ?? def.modes?.[0];
  const activeMode2 = def.modes2?.find((m) => m.id === mode2) ?? def.modes2?.[0];
  const header = (activeMode?.valueHeader ?? def.valueHeader) + (activeMode2?.valueHeader ?? '');
  const [over, under] = def.directionLabels ?? ['Over', 'Under'];
  const directions: { id: Direction; label: string }[] = [{ id: 'desc', label: over }, { id: 'asc', label: under }];
  const toggles = [
    def.sortable && onDirection && <Toggle key="dir" label="Direction" options={directions} value={direction} onChange={onDirection} />,
    def.modes && activeMode && onMode && <Toggle key="mode" label="View" options={def.modes.map((m) => ({ id: m.id, label: m.label }))} value={activeMode.id} onChange={onMode} />,
    def.modes2 && activeMode2 && onMode2 && <Toggle key="mode2" label="Per game" options={def.modes2.map((m) => ({ id: m.id, label: m.label }))} value={activeMode2.id} onChange={onMode2} />,
  ].filter(Boolean);
  // the record: the top row and any row tied with it, unless the tie is more than three deep or the whole board (then nobody stands out)
  const tiedAtTop = rows.filter((r) => r.value === rows[0]?.value).length;
  const recordValue = tiedAtTop <= MAX_CROWNS && (tiedAtTop < rows.length || rows.length === 1) ? rows[0]?.value : undefined;
  return (
    <section className="card overflow-hidden" aria-labelledby={`board-${def.id}`}>
      <header className="border-b border-line px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1.5">
            <h3 id={`board-${def.id}`} className="text-base font-semibold leading-tight text-ink">{def.title}</h3>
            <button
              type="button"
              aria-label="What counts"
              aria-expanded={about.open}
              aria-describedby={about.open ? aboutId : undefined}
              {...about.buttonProps}
              className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[10px] font-semibold leading-none ${about.open ? 'border-ink bg-ink text-bg' : 'border-line text-muted hover:border-ink hover:text-ink'}`}
            >
              ?
            </button>
          </span>
          <span className="section-label shrink-0 pt-1">{header}</span>
        </div>
        {about.open && <p id={aboutId} role="tooltip" className="mt-1.5 rounded-md bg-surface-2 px-2.5 py-2 text-xs leading-snug text-ink">{def.definition}</p>}
        {(onPosition || toggles.length > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {onPosition && <PositionFilter value={position ?? 'All'} onChange={onPosition} size="sm" />}
            {toggles.length > 0 && <span className="ml-auto flex flex-wrap items-center justify-end gap-2">{toggles}</span>}
          </div>
        )}
      </header>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-sm text-muted">{empty ?? (def.tab === 'managers' ? 'Nothing recorded yet.' : 'No players at this position.')}</p>
      ) : (
        <ol className="divide-y divide-line">
          {shown.map((r, i) => {
            const m = r.userId ? managers[r.userId] : undefined;
            const record = r.value === recordValue;
            const metaNode = r.to
              ? <Link to={r.to} className="num hover:text-accent">{r.meta}</Link>
              : <span className="num">{r.meta}</span>;
            return (
              <li key={r.key} data-rank={i + 1} className={`flex flex-wrap items-center gap-3 px-3 py-2 ${record ? RECORD_ROW : ''}`}>
                <span className={`num w-4 shrink-0 text-right text-xs ${record ? 'font-bold text-gold' : 'text-muted'}`}>{record ? <CrownIcon title="League record" /> : i + 1}</span>
                {r.playerId !== null ? <Headshot players={players} id={r.playerId} size={28} /> : <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? r.userId ?? '?'} size={28} />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    {r.playerId !== null ? (
                      <>
                        <PosPill pos={playerPos(players, r.playerId)} />
                        <span className={`truncate text-sm ${record ? 'font-semibold' : 'font-medium'}`}>{playerName(players, r.playerId)}</span>
                      </>
                    ) : (
                      <Link to={`/managers/${r.userId}`} className={`truncate text-sm hover:text-accent ${record ? 'font-semibold' : 'font-medium'}`}>{m?.displayName ?? r.userId}</Link>
                    )}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
                    {metaNode}
                    {r.detail && !r.player && <><span aria-hidden>·</span><span>{r.detail}</span></>}
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
                          <Link key={x.userId} to={`/managers/${x.userId}`} className="flex items-center gap-1 hover:text-accent">
                            <Avatar avatar={managers[x.userId]?.avatar ?? null} name={managerName(x.userId)} size={14} />
                            <span>{managerName(x.userId)} {x.weeks} wks</span>
                          </Link>
                        ))}
                      </>
                    ) : r.playerId !== null && r.userId && (
                      <>
                        <span aria-hidden>·</span>
                        <Link to={`/managers/${r.userId}`} className="flex items-center gap-1 hover:text-accent">
                          <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? r.userId} size={14} />
                          <span>{m?.displayName ?? r.userId}</span>
                        </Link>
                      </>
                    )}
                  </span>
                </span>
                {r.player && (
                  // the player a manager row names: right-aligned, headshot against the value, so the headshots line up down the board;
                  // on a phone the row wraps and the block takes a full second line, so neither name nor the detail is squeezed
                  <span data-testid="row-player" className="order-last flex min-w-0 basis-full shrink-0 items-center justify-end gap-2 text-right md:order-none md:basis-2/5">
                    <span className="min-w-0">
                      <span className="flex items-center justify-end gap-1.5">
                        <PosPill pos={playerPos(players, r.player)} />
                        <span className="truncate text-sm font-medium">{playerName(players, r.player)}</span>
                      </span>
                      {r.detail && <span className="mt-0.5 block truncate text-xs text-muted">{r.detail}</span>}
                    </span>
                    <Headshot players={players} id={r.player} size={28} />
                  </span>
                )}
                <span className={`num shrink-0 text-base font-semibold ${record ? 'text-gold' : r.tone === 'win' ? 'text-win' : r.tone === 'loss' ? 'text-loss' : ''}`}>{r.valueLabel}</span>
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
