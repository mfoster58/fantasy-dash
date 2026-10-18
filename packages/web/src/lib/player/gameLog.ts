import type { PlayerDb, PlayerId, Season } from '@fantasy-dash/core';
import { aggregate, aggregateWeeks, type Agg } from '../playerdb/aggregate';
import type { ColumnDef } from '../playerdb/columns';
import { columnTints } from '../playerdb/percentile';
import type { PlayerLine } from '../playerLines';

export interface LogRow { week: number; agg: Agg | null; bye: boolean; opp: string; line: PlayerLine | null; score: { mine: number; theirs: number } | null; swing: number | null }

/** One row per database week: his advanced numbers beside the league week he spent on a roster, if any. */
export function gameLog(db: PlayerDb, id: PlayerId, lines: PlayerLine[], season: Season | undefined): LogRow[] {
  const mine = db.rows.filter((r) => r.id === id).sort((a, b) => a.week - b.week);
  const hasTeamWeek = (team: string, w: number) => db.teamWeeks.some((t) => t.team === team && t.week === w);
  return Array.from({ length: Math.max(0, db.throughWeek) }, (_, i) => i + 1).map((week) => {
    const row = mine.find((r) => r.week === week);
    const line = lines.find((l) => l.week === week && !l.consolation) ?? null;
    const game = line ? season?.weeks[week - 1]?.games.find((g) => g.id === line.gameId) : undefined;
    const me = game?.sides.find((s) => s.userId === line!.userId), them = game?.sides.find((s) => s.userId !== line!.userId);
    const score = me && them ? { mine: me.points, theirs: them.points } : null;
    // benched in a loss by less than he scored
    const swing = line && score && !line.started && line.result === 'L' && line.points > score.theirs - score.mine ? line.points : null;
    if (row) return { week, agg: aggregateWeeks(db, [row], 1), bye: false, opp: row.opp ?? '', line, score, swing };
    const prev = [...mine].reverse().find((r) => r.week < week), next = mine.find((r) => r.week > week);
    const teams = [prev?.team, next?.team].filter((t): t is string => Boolean(t));
    return { week, agg: null, bye: line?.bye || (teams.length > 0 && teams.every((t) => !hasTeamWeek(t, week))), opp: '', line, score, swing };
  });
}

/** Per column, a tint for each row: his value against every same-position player that week. */
export function weekTints(db: PlayerDb, rows: LogRow[], cols: ColumnDef[], pos: string): Map<string, string[]> {
  const out = new Map(cols.map((c) => [c.key, rows.map(() => 'transparent')] as const));
  rows.forEach((r, i) => {
    if (!r.agg) return;
    const peers = aggregate(db, r.week, r.week).filter((a) => db.players[a.id]?.pos === pos);
    const idx = peers.findIndex((a) => a.id === r.agg!.id);
    if (idx < 0) return;
    for (const c of cols) out.get(c.key)![i] = columnTints(c, peers, 'total')[idx];
  });
  return out;
}
