import { useState } from 'react';
import type { History, PlayerDirectory } from '@fantasy-dash/core';
import type { BoardContext, BoardDef, Direction } from '../../lib/playerBoards';
import type { PosFilter } from '../../lib/playerLines';
import SeasonPicker from '../SeasonPicker';
import Board from './Board';
import PositionFilter from './PositionFilter';

interface Props {
  id: string;
  title: string;
  note: string;
  boards: BoardDef[];
  /** lines already narrowed to this section's position */
  ctx: BoardContext;
  players: PlayerDirectory;
  managers: History['managers'];
  pos: PosFilter;
  onPos: (p: PosFilter) => void;
  columns: 2 | 3;
  seasonPicker?: { years: number[]; value: number; onChange: (y: number) => void };
  /** when set, shown in place of the boards */
  emptyMessage?: string | null;
}

/** One titled block of boards with its own position filter, optional season picker and a shared expand state. */
export default function Section({ id, title, note, boards, ctx, players, managers, pos, onPos, columns, seasonPicker, emptyMessage }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [directions, setDirections] = useState<Record<string, Direction>>({});
  return (
    <section id={id} aria-labelledby={`section-${id}`} className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={`section-${id}`} className="text-lg font-semibold">{title}</h2>
        <span className="text-xs text-muted">{note}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PositionFilter value={pos} onChange={onPos} />
        {seasonPicker && <SeasonPicker years={seasonPicker.years} value={seasonPicker.value} onChange={seasonPicker.onChange} />}
      </div>
      {emptyMessage ? (
        <p className="card p-4 text-sm text-muted">{emptyMessage}</p>
      ) : (
        <div className={`grid gap-4 ${columns === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {boards.map((b) => {
            const direction = directions[b.id] ?? 'desc';
            return (
              <Board
                key={b.id}
                def={b}
                rows={b.compute(ctx, direction)}
                players={players}
                managers={managers}
                expanded={expanded}
                onToggle={() => setExpanded((v) => !v)}
                direction={direction}
                onDirection={b.sortable ? (d) => setDirections((m) => ({ ...m, [b.id]: d })) : undefined}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
