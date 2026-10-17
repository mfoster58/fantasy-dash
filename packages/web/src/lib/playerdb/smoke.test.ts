// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { PlayerDbSchema, type PlayerDb } from '@fantasy-dash/core';
import { aggregate } from './aggregate';
import { TABS, columnValue, columnsFor, tabPositions } from './columns';

const dir = new URL('../../../../../data/playerdb/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe('committed player databases', () => {
  it.each(files)('%s validates and aggregates for every tab without NaN', (file) => {
    const db = PlayerDbSchema.parse(JSON.parse(readFileSync(new URL(file, dir), 'utf8'))) as PlayerDb;
    expect(db.rows.length).toBeGreaterThan(500);
    const aggs = aggregate(db, 1, db.throughWeek);
    for (const tab of TABS) {
      const rows = aggs.filter((a) => tabPositions(tab).includes(db.players[a.id].pos));
      expect(rows.length, `${file} ${tab}`).toBeGreaterThan(20);
      for (const c of columnsFor(tab)) for (const a of rows) {
        const v = columnValue(c, a, 'total');
        expect(v === null || Number.isFinite(v), `${file} ${tab} ${c.key} ${a.id}`).toBe(true);
      }
    }
  });
});
