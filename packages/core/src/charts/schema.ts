import { z } from 'zod';
import { GRADE_KEYS, LANES, ROUTES, RZ_KEYS, SPLITS, TARGET_FILTERS, ZONES } from './types';

const tuple = (n: number) => z.array(z.number()).length(n);
const table = <T extends readonly [string, ...string[]]>(keys: T, n: number) => z.record(z.enum(keys), tuple(n));
const ZoneEnum = ZONES as unknown as readonly [string, ...string[]];

const PlayCounts = z.object({ rush: tuple(4).optional(), rz: table(RZ_KEYS, 2).optional(), qtr: tuple(4).optional() });

export const ChartDbSchema = z.object({
  year: z.number(),
  builtAt: z.string(),
  participation: z.boolean(),
  ftn: z.boolean().optional(),
  teams: z.record(z.record(z.array(z.number()).min(2))).optional(),
  injuries: z.record(z.record(z.tuple([z.string(), z.string()]))),
  players: z.record(z.object({
    pos: z.enum(['QB', 'RB', 'WR', 'TE']),
    routes: z.object({ all: table(ROUTES, 5), man: table(ROUTES, 5), zone: table(ROUTES, 5) }).optional(),
    lanes: z.object({ all: table(LANES, 5), light: table(LANES, 5), heavy: table(LANES, 5) }).optional(),
    zones: z.object({ all: table(ZoneEnum, 8), clean: table(ZoneEnum, 8), pressured: table(ZoneEnum, 8) }).optional(),
    splits: table(SPLITS, 6).optional(),
    throws: z.object({ all: table(ROUTES, 5), man: table(ROUTES, 5), zone: table(ROUTES, 5) }).optional(),
    targets: z.record(z.enum(TARGET_FILTERS), table(ZoneEnum, 5)).optional(),
    grades: z.record(z.enum(GRADE_KEYS), z.number()).optional(),
    plays: PlayCounts.extend({ weeks: z.record(PlayCounts).optional() }).optional(),
  })),
});
