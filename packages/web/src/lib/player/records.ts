import type { PlayerId } from '@fantasy-dash/core';
import type { BoardContext } from '../boards/shared';
import { subTabsOf } from '../boards/tabs';
import type { ManagerRecord } from '../managerRecords';
import { boardsFor } from '../playerBoards';
import { filterLines, isPosFilter } from '../playerLines';

/**
 * Every players-tab record board where his row ranks ≤ maxRank (ties share a rank), over all positions and then his own.
 * Leaders is skipped: those are this season's tables, not records.
 */
export function playerRecords(ctx: BoardContext, id: PlayerId, pos: string, maxRank = 3): ManagerRecord[] {
  const out: ManagerRecord[] = [];
  const seen = new Set<string>();
  const passes: { ctx: BoardContext; suffix: string }[] = [{ ctx: { ...ctx, pos: 'All' }, suffix: '' }];
  if (isPosFilter(pos) && pos !== 'All') passes.push({ ctx: { ...ctx, pos, lines: filterLines(ctx.lines, pos), allLines: ctx.allLines ?? ctx.lines }, suffix: pos });
  for (const pass of passes) {
    for (const sub of subTabsOf('players')) {
      if (sub.id === 'leaders') continue;
      for (const def of boardsFor('players', sub.id)) {
        if (pass.suffix && seen.has(def.id)) continue;
        const rows = def.compute(pass.ctx);
        const r = rows.find((x) => x.playerId === id);
        if (!r) continue;
        const rank = rows.findIndex((o) => o.value === r.value) + 1;
        if (rank > maxRank) continue;
        seen.add(def.id);
        out.push({
          sub: sub.id, subTitle: sub.title, boardId: pass.suffix ? `${def.id}:${pass.suffix}` : def.id,
          title: pass.suffix ? `${def.title} · ${pass.suffix}` : def.title, rank, valueLabel: r.valueLabel, meta: r.meta, detail: r.detail,
        });
      }
    }
  }
  return out;
}
