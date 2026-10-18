// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { ChartDbSchema, type ChartDb } from '@fantasy-dash/core';
import { chartItems } from './rank';
import { LANE_SPEC, ROUTE_SPEC, SPLIT_SPEC, ZONE_SPEC } from './specs';

const dir = new URL('../../../../../data/charts/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const load = (f: string) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as ChartDb;
const sum = (t: Record<string, number[] | undefined>) => Object.values(t).reduce((a, c) => a + (c?.[0] ?? 0), 0);
const NACUA = '00-0039075', BIJAN = '00-0038542', ALLEN = '00-0034857';

describe('chart files over the committed data', () => {
  it('every file parses', () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
    for (const f of files) expect(() => ChartDbSchema.parse(load(f)), f).not.toThrow();
  });
  it('2025 matches the regular-season counts measured when the plan was written', () => {
    const db = load('2025.json');
    expect(sum(db.players[NACUA].routes!.all)).toBe(163);
    expect(db.players[NACUA].routes!.all['IN/DIG']![0]).toBe(20);
    expect(sum(db.players[BIJAN].lanes!.all)).toBe(287);
    expect(db.players[BIJAN].lanes!.all.RT![0]).toBe(61);
    expect(db.players[ALLEN].splits!.all![0]).toBe(507);
    expect(db.players[ALLEN].zones!.all['short|right']![0]).toBe(84);
  });
  it('every item of the three 2025 players ranks in 0–100 or is unranked, under every metric', () => {
    const db = load('2025.json');
    const check = (items: { pct: number | null }[] | null) => { for (const i of items ?? []) expect(i.pct === null || (i.pct >= 0 && i.pct <= 100)).toBe(true); };
    for (const m of ['share', ...Object.keys(ROUTE_SPEC.metrics)]) for (const f of ['all', 'man', 'zone'] as const) check(chartItems(ROUTE_SPEC, db, NACUA, f, m));
    for (const m of ['share', ...Object.keys(LANE_SPEC.metrics)]) for (const f of ['all', 'light', 'heavy'] as const) check(chartItems(LANE_SPEC, db, BIJAN, f, m));
    for (const m of ['share', ...Object.keys(ZONE_SPEC.metrics)]) for (const f of ['all', 'clean', 'pressured'] as const) check(chartItems(ZONE_SPEC, db, ALLEN, f, m));
    for (const m of Object.keys(SPLIT_SPEC.metrics)) check(chartItems(SPLIT_SPEC, db, ALLEN, 'all', m));
  });
});
