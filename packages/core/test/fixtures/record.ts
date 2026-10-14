/**
 * One-off recorder. Saves the real playoff data for completed seasons so the
 * oracle test runs offline. Re-run only if Sleeper data changes:
 *   pnpm --filter @fantasy-dash/core exec tsx test/fixtures/record.ts
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SleeperClient } from '../../src/sleeper/client';

const SEASONS: Record<number, string> = {
  2023: '1000241943814770688',
  2024: '1124847899579023360',
  2025: '1253602506592763904',
};

const client = new SleeperClient();
const dir = path.dirname(new URL(import.meta.url).pathname);

for (const [year, id] of Object.entries(SEASONS)) {
  const league = await client.getLeague(id);
  if (!league) throw new Error(`league ${id} missing`);
  const [users, rosters, winnersBracket, losersBracket] = await Promise.all([
    client.getUsers(id), client.getRosters(id), client.getWinnersBracket(id), client.getLosersBracket(id),
  ]);
  const start = league.settings.playoff_week_start;
  const rounds = Math.max(...(winnersBracket ?? []).map((g) => g.r));
  const matchups: Record<number, unknown> = {};
  for (let w = start; w < start + rounds; w++) matchups[w] = await client.getMatchups(id, w);
  const out = { league, users, rosters, winnersBracket, losersBracket, matchups };
  await writeFile(path.join(dir, `playoffs-${year}.json`), JSON.stringify(out));
  console.log(`recorded ${year}: weeks ${start}-${start + rounds - 1}`);
}
