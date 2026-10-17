import type { RawSeasonInput } from '../../src/season';
import type { SleeperMatchup, SleeperRoster, SleeperUser } from '../../src/sleeper/types';
import type { PlayerDirectory, PlayerInfo } from '../../src/types';

/**
 * Four teams (ua, ub, uc, ud), roster slots QB / RB / FLEX, three regular-season
 * weeks, playoffs would start week 4 (no brackets). Each team n owns players
 * q{n} (QB), r{n} (RB), w{n} (WR) as starters and b{n} (RB) on the bench.
 *
 * Default points split per week: QB = total - 20, RB = 10, WR = 10, bench 0,
 * so the ceiling equals the actual score. The one exception is team A in week 2,
 * which started an 8-point WR over a 30-point bench RB: actual 60, ceiling 82.
 *
 * Expected standings (hand computed):
 *   C 3-0   PF 320  PA 200  all-play 7-2-0  streak W3  highs 2
 *   A 2-1   PF 280  PA 250  all-play 5-4-0  streak W1  highs 1  max 302
 *   B 0-2-1 PF 255  PA 325  all-play 4-4-1  streak L1
 *   D 0-2-1 PF 215  PA 295  all-play 1-7-1  streak L1
 */
const ROSTER: Record<string, number> = { ua: 1, ub: 2, uc: 3, ud: 4 };
const TOTALS: Record<number, Record<string, number>> = {
  1: { ua: 100, ub: 90, uc: 80, ud: 70 },
  2: { ua: 60, uc: 110, ub: 95, ud: 95 },
  3: { ua: 120, ud: 50, ub: 70, uc: 130 },
};
const PAIRINGS: Record<number, [string, string][]> = {
  1: [['ua', 'ub'], ['uc', 'ud']],
  2: [['ua', 'uc'], ['ub', 'ud']],
  3: [['ua', 'ud'], ['ub', 'uc']],
};

function team(n: number) {
  return { q: `q${n}`, r: `r${n}`, w: `w${n}`, b: `b${n}` };
}

function matchup(userId: string, week: number, matchupId: number): SleeperMatchup {
  const n = ROSTER[userId];
  const t = team(n);
  const total = TOTALS[week][userId];
  let pp: Record<string, number> = { [t.q]: total - 20, [t.r]: 10, [t.w]: 10, [t.b]: 0 };
  if (userId === 'ua' && week === 2) pp = { [t.q]: 42, [t.r]: 10, [t.w]: 8, [t.b]: 30 };
  return {
    roster_id: n,
    matchup_id: matchupId,
    points: total,
    custom_points: null,
    players: [t.q, t.r, t.w, t.b],
    starters: [t.q, t.r, t.w],
    players_points: pp,
  };
}

function info(id: string, position: string): PlayerInfo {
  return { id, name: id.toUpperCase(), firstName: id, lastName: '', position, team: null, yearsExp: null, birthDate: null };
}

function user(user_id: string, display_name: string, team_name: string | null): SleeperUser {
  return { user_id, display_name, avatar: null, metadata: team_name ? { team_name } : null };
}

export function miniInput(): RawSeasonInput {
  const matchups: Record<number, SleeperMatchup[]> = {};
  for (const [wk, pairs] of Object.entries(PAIRINGS)) {
    const week = Number(wk);
    matchups[week] = pairs.flatMap(([a, b], i) => [matchup(a, week, i + 1), matchup(b, week, i + 1)]);
  }
  const players: PlayerDirectory = {};
  const rosters: SleeperRoster[] = [];
  for (const [userId, n] of Object.entries(ROSTER)) {
    const t = team(n);
    players[t.q] = info(t.q, 'QB');
    players[t.r] = info(t.r, 'RB');
    players[t.w] = info(t.w, 'WR');
    players[t.b] = info(t.b, 'RB');
    rosters.push({ roster_id: n, owner_id: userId, players: [t.q, t.r, t.w, t.b], starters: [t.q, t.r, t.w] });
  }
  return {
    league: {
      league_id: 'L2024',
      name: 'Mini',
      season: '2024',
      status: 'complete',
      previous_league_id: null,
      total_rosters: 4,
      roster_positions: ['QB', 'RB', 'FLEX', 'BN'],
      scoring_settings: { pass_yd: 0.04, rush_yd: 0.1 },
      settings: { playoff_week_start: 4, playoff_teams: 2, last_scored_leg: 3 },
    },
    users: [user('ua', 'Alice', 'Team Alice'), user('ub', 'Bob', null), user('uc', 'Cara', 'Cara Crew'), user('ud', 'Dan', 'Dan Dynasty')],
    rosters,
    matchups,
    winnersBracket: [],
    losersBracket: [],
    projections: { 1: { q1: { pass_yd: 250 } } },
    stats: { 1: { q1: { pass_yd: 250, pass_td: 1, pos_rank_ppr: 5 } } },
    players,
    playerSeasonPoints: { q1: 80, q2: 70, q3: 90, q4: 50, r1: 10, r2: 10, r3: 10, r4: 10, w1: 30, w2: 30, w3: 30, w4: 30, b1: 30, b2: 0, b3: 0, b4: 0 },
    playerGames: {}, teamGames: {}, playerTeams: {}, transactions: [],
    draft: {
      draft: { draft_id: 'DM', type: 'snake', status: 'complete', settings: { rounds: 2, teams: 4 }, draft_order: { ua: 1, ub: 2, uc: 3, ud: 4 }, slot_to_roster_id: null },
      picks: [
        { round: 1, pick_no: 1, draft_slot: 1, roster_id: 1, picked_by: 'ua', player_id: 'q1', is_keeper: null },
        { round: 1, pick_no: 2, draft_slot: 2, roster_id: 2, picked_by: 'ub', player_id: 'q2', is_keeper: null },
        { round: 1, pick_no: 3, draft_slot: 3, roster_id: 3, picked_by: 'uc', player_id: 'q3', is_keeper: true },
        { round: 1, pick_no: 4, draft_slot: 4, roster_id: 4, picked_by: 'ud', player_id: 'q4', is_keeper: null },
        { round: 2, pick_no: 5, draft_slot: 4, roster_id: 4, picked_by: 'ud', player_id: 'r4', is_keeper: null },
        { round: 2, pick_no: 6, draft_slot: 3, roster_id: 3, picked_by: 'uc', player_id: 'r3', is_keeper: null },
        { round: 2, pick_no: 7, draft_slot: 2, roster_id: 2, picked_by: 'ub', player_id: 'r2', is_keeper: null },
        { round: 2, pick_no: 8, draft_slot: 1, roster_id: 1, picked_by: 'ua', player_id: 'r1', is_keeper: null },
      ],
    },
  };
}
