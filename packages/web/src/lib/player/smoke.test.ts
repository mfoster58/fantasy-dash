// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import type { PlayerDb, PlayerDirectory, Season } from '@fantasy-dash/core';
import { flattenLines } from '../playerLines';
import { gameLog } from './gameLog';
import { journeyOf } from './journey';
import { percentileBars } from './percentiles';
import { seasonTable } from './seasons';

const root = new URL('../../../../../data/', import.meta.url);
const json = <T,>(rel: string) => JSON.parse(readFileSync(new URL(rel, root), 'utf8')) as T;
const seasons = readdirSync(new URL('seasons/', root)).filter((f) => f.endsWith('.json')).map((f) => json<Season>(`seasons/${f}`));
const dbs = readdirSync(new URL('playerdb/', root)).filter((f) => f.endsWith('.json')).map((f) => json<PlayerDb>(`playerdb/${f}`));
const players = json<PlayerDirectory>('players.json');
const lines = flattenLines(seasons, players);
/** no NaN or Infinity anywhere inside */
const finite = (o: unknown): boolean => !JSON.stringify(o, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? '__BAD__' : v)).includes('__BAD__');

describe('player pages over the committed data', () => {
  it('builds a season table and a path for every rostered player, with no NaN and no backwards stint', () => {
    const byId = new Map<string, typeof lines>();
    for (const l of lines) byId.set(l.playerId, [...(byId.get(l.playerId) ?? []), l]);
    for (const [id, mine] of byId) {
      expect(finite(seasonTable(mine, seasons, id)), `${id} table`).toBe(true);
      for (const s of journeyOf(mine, seasons, players, id)) {
        expect(finite(s), `${id} stint`).toBe(true);
        if (s.to) expect(s.to.year * 100 + s.to.week >= s.from.year * 100 + s.from.week, `${id} ${s.userId} ${JSON.stringify(s.from)}→${JSON.stringify(s.to)}`).toBe(true);
      }
    }
  });
  it("builds percentile bars and a game log for a sample of each season's players", () => {
    for (const db of dbs) {
      const season = seasons.find((s) => s.year === db.year);
      for (const id of Object.keys(db.players).filter((_, i) => i % 25 === 0)) {
        expect(finite(percentileBars(db, id)), `${db.year} ${id} bars`).toBe(true);
        const log = gameLog(db, id, lines.filter((l) => l.playerId === id && l.year === db.year), season);
        expect(finite(log.map((r) => ({ ...r, agg: null }))), `${db.year} ${id} log`).toBe(true);
      }
    }
  }, 30_000); // each call aggregates a whole season, about a hundred of them
});
