import { z } from 'zod';
import { PLAYER_WEEK_KEYS } from './types';

const KEYS = new Set<string>(PLAYER_WEEK_KEYS);
const Pos = z.enum(['QB', 'RB', 'WR', 'TE']);

const PlayerWeek = z.object({ id: z.string(), week: z.number().int().min(1), team: z.string(), gp: z.number(), opp: z.string().optional() })
  .catchall(z.number())
  .superRefine((row, ctx) => {
    for (const k of Object.keys(row)) {
      if (k === 'id' || k === 'week' || k === 'team' || k === 'gp' || k === 'opp' || KEYS.has(k)) continue;
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unknown PlayerWeek key ${k}` });
    }
  });

const DbPlayer = z.object({
  id: z.string(), gsisId: z.string().nullable(), pfrId: z.string().nullable(), espnId: z.string().nullable().optional(), name: z.string(), pos: Pos,
  teams: z.array(z.string()), birthDate: z.string().nullable(), yearsExp: z.number().nullable(),
  draft: z.object({ year: z.number(), round: z.number(), pick: z.number() }).nullable(),
  college: z.string().nullable(), height: z.number().nullable(), weight: z.number().nullable(),
});

const TeamWeek = z.object({
  team: z.string(), week: z.number(), opp: z.string(), offSnaps: z.number(), passAtt: z.number(), rushAtt: z.number(),
  dropbacks: z.number(), rzLooks: z.number(), airYds: z.number(), passPlays: z.number().nullable(),
});

const Coef = z.array(z.number()).nullable();

export const PlayerDbSchema = z.object({
  year: z.number(), throughWeek: z.number(), routesReal: z.boolean(), builtAt: z.string(),
  players: z.record(DbPlayer),
  teamWeeks: z.array(TeamWeek),
  xfp: z.object({ QB: Coef, RB: Coef, WR: Coef, TE: Coef }),
  rows: z.array(PlayerWeek),
});

/** The stored, league-neutral player database; old files that still carry xfp coefficients parse too (zod drops the key). */
export const SharedPlayerDbSchema = PlayerDbSchema.omit({ xfp: true });

export const LeaguePointsSchema = z.object({
  year: z.number(), leagueId: z.string(), builtAt: z.string(), dbBuiltAt: z.string(),
  xfp: z.object({ QB: Coef, RB: Coef, WR: Coef, TE: Coef }),
  players: z.record(z.array(z.tuple([z.number(), z.number(), z.number().nullable(), z.number().nullable()]))),
});
