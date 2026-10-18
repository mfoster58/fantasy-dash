import { flattenLines } from '../playerLines';
import { COLUMNS } from '../playerdb/columns';
import { gameLog, weekTints } from './gameLog';
import { leagueSeasons } from '../../test/playerPageFixtures';
import { players } from '../../test/playerFixtures';
import { miniDb } from '../../test/playerDbFixtures';

const s26 = () => leagueSeasons()[1];
const linesOf = (id: string) => flattenLines(leagueSeasons(), players).filter((l) => l.playerId === id && l.year === 2026);

describe('gameLog', () => {
  it('has a row per database week, with the league week alongside when rostered', () => {
    const rows = gameLog(miniDb(), 'w1', linesOf('w1'), s26());
    expect(rows.map((r) => r.week)).toEqual([1, 2, 3]);
    expect(rows[0]).toMatchObject({ line: { userId: 'B', started: true }, score: { mine: 105, theirs: 100 }, swing: null });
    expect(rows[0].agg?.s.pts).toBeDefined();
    expect(rows[2].line).toBeNull();
  });
  it('separates a bye from a missed game', () => {
    const db = miniDb();
    const wk2 = db.rows.find((r) => r.id === 'w1' && r.week === 2)!;
    db.rows = db.rows.filter((r) => r !== wk2);
    expect(gameLog(db, 'w1', [], undefined)[1]).toMatchObject({ agg: null, bye: false });
    const teams = new Set(db.rows.filter((r) => r.id === 'w1').map((r) => r.team));
    db.teamWeeks = db.teamWeeks.filter((t) => !(t.week === 2 && teams.has(t.team)));
    expect(gameLog(db, 'w1', [], undefined)[1]).toMatchObject({ agg: null, bye: true });
  });
  it('works without a league season', () => {
    expect(gameLog(miniDb(), 'w1', [], undefined).every((r) => r.line === null && r.score === null)).toBe(true);
  });
  it('marks points left on the bench in a loss they would have swung', () => {
    const s = leagueSeasons();
    const lines = flattenLines(s, players).filter((l) => l.playerId === 'w1' && l.year === 2025);
    const db = { ...miniDb(), year: 2025 };
    expect(gameLog(db, 'w1', lines, s[0])[1]).toMatchObject({ line: { started: false }, score: { mine: 95, theirs: 100 }, swing: 30 });
  });
  it('tints each week against his position that week', () => {
    const db = miniDb();
    const rows = gameLog(db, 'w1', [], undefined);
    const t = weekTints(db, rows, [COLUMNS.tgt], 'WR');
    expect(t.get('tgt')).toHaveLength(3);
    expect(t.get('tgt')![0]).not.toBe('transparent');
  });
});
