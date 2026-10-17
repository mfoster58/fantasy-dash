import { useEffect, useState } from 'react';
import type { History, PlayerDirectory } from '@fantasy-dash/core';
import type { BoardContext, BoardDef, Direction } from '../../lib/playerBoards';
import { filterLines, type PlayerLine, type PosFilter } from '../../lib/playerLines';
import SeasonPicker from '../SeasonPicker';
import Board from './Board';
import PositionFilter from './PositionFilter';

interface Props {
  id: string;
  title: string;
  boards: BoardDef[];
  /** lines already narrowed to this section's position */
  ctx: BoardContext;
  /** the same lines before the position filter, for a board whose own dropdown overrides it; defaults to ctx.lines */
  allLines?: PlayerLine[];
  players: PlayerDirectory;
  managers: History['managers'];
  pos?: PosFilter;
  /** absent: no position filter (the managers side) */
  onPos?: (p: PosFilter) => void;
  columns: 2 | 3;
  seasonPicker?: { years: number[]; value: number | 'all'; onChange: (v: number | 'all') => void; allTime?: boolean };
  /** when set, shown in place of the boards */
  emptyMessage?: string | null;
  /** another tab is chosen: stay mounted, so toggles and expand state survive, but out of view and without computing any board */
  hidden?: boolean;
}

/** Tailwind's md breakpoint, where the board grid gains its columns. */
const GRID_QUERY = '(min-width: 768px)';

/** True when the grid is laid out in columns; true where matchMedia is unavailable (tests, SSR). */
function useGridColumns(): boolean {
  const query = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(GRID_QUERY).matches : true);
  const [wide, setWide] = useState(query);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(GRID_QUERY);
    const onChange = () => setWide(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return wide;
}

/** One titled block of boards with its own position filter, optional season picker, and expand state shared per grid row. */
export default function Section({ id, title, boards, ctx, allLines, players, managers, pos, onPos, columns, seasonPicker, emptyMessage, hidden = false }: Props) {
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [directions, setDirections] = useState<Record<string, Direction>>({});
  const [modes, setModes] = useState<Record<string, string>>({});
  const [modes2, setModes2] = useState<Record<string, string>>({});
  // per-board position overrides; the section's own filter changing clears them
  const [boardPos, setBoardPos] = useState<Record<string, PosFilter>>({});
  useEffect(() => { setBoardPos({}); }, [pos]);
  const perRow = useGridColumns() ? columns : 1;
  // row indexes mean different boards once the column count changes, so start collapsed again
  useEffect(() => { setExpandedRows({}); }, [perRow]);
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} hidden={hidden}>
    <section id={id} aria-labelledby={`section-${id}`} className="space-y-3">
      <h2 id={`section-${id}`} className="text-lg font-semibold">{title}</h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {onPos && <PositionFilter value={pos ?? 'All'} onChange={onPos} />}
        {seasonPicker && <SeasonPicker years={seasonPicker.years} value={seasonPicker.value} onChange={seasonPicker.onChange} allTime={seasonPicker.allTime} />}
      </div>
      {emptyMessage ? (
        <p className="card p-4 text-sm text-muted">{emptyMessage}</p>
      ) : hidden ? null : (
        <div className={`grid gap-4 ${columns === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {boards.map((b, i) => {
            const row = Math.floor(i / perRow);
            const direction = directions[b.id] ?? 'desc';
            const mode = modes[b.id] ?? b.modes?.[0]?.id;
            const mode2 = modes2[b.id] ?? b.modes2?.[0]?.id;
            // player boards always take a position of their own; a manager board only when it names players, and then it keeps every line
            const offersPos = b.tab === 'players' || b.positions === true;
            const override = boardPos[b.id];
            const bctx: BoardContext = override === undefined ? ctx : { ...ctx, pos: override, lines: b.tab === 'players' ? filterLines(allLines ?? ctx.lines, override) : ctx.lines };
            return (
              <Board
                key={b.id}
                def={b}
                rows={b.compute(bctx, direction, mode, mode2)}
                players={players}
                managers={managers}
                expanded={expandedRows[row] ?? false}
                onToggle={() => setExpandedRows((m) => ({ ...m, [row]: !m[row] }))}
                direction={direction}
                onDirection={b.sortable ? (d) => setDirections((m) => ({ ...m, [b.id]: d })) : undefined}
                mode={mode}
                onMode={b.modes ? (m) => setModes((s) => ({ ...s, [b.id]: m })) : undefined}
                mode2={mode2}
                onMode2={b.modes2 ? (m) => setModes2((s) => ({ ...s, [b.id]: m })) : undefined}
                position={override ?? pos ?? 'All'}
                onPosition={offersPos ? (p) => setBoardPos((s) => ({ ...s, [b.id]: p })) : undefined}
                empty={b.empty?.(bctx, mode, mode2)}
              />
            );
          })}
        </div>
      )}
    </section>
    </div>
  );
}
