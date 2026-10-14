/** Shapes returned by https://api.sleeper.app/v1. Only the fields we read. */

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  status: string; // 'pre_draft' | 'drafting' | 'in_season' | 'complete'
  previous_league_id: string | null;
  total_rosters: number;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
  settings: {
    playoff_week_start: number;
    playoff_teams: number;
    last_scored_leg?: number;
    leg?: number;
    [key: string]: unknown;
  };
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
  avatar: string | null;
  metadata?: { team_name?: string | null; [key: string]: unknown } | null;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
  starters: string[] | null;
}

export interface SleeperMatchup {
  roster_id: number;
  matchup_id: number | null;
  points: number;
  custom_points: number | null;
  players: string[] | null;
  starters: string[] | null;
  players_points: Record<string, number> | null;
}

export interface SleeperBracketGame {
  r: number;
  m: number;
  t1?: number | null;
  t2?: number | null;
  w?: number | null;
  l?: number | null;
  p?: number;
  t1_from?: { w?: number; l?: number };
  t2_from?: { w?: number; l?: number };
}

export interface SleeperPlayer {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position?: string | null;
  team?: string | null;
  years_exp?: number | null;
}

/** player_id -> stat line. Used for both /stats and /projections. */
export type StatMap = Record<string, Record<string, number>>;

export interface SleeperDraft {
  draft_id: string;
  type: string;
  status: string;
  settings: { rounds: number; teams: number; [k: string]: unknown };
  draft_order: Record<string, number> | null;
  slot_to_roster_id: Record<string, number> | null;
}

export interface SleeperDraftPick {
  round: number;
  pick_no: number;
  draft_slot: number;
  roster_id: number | null;
  picked_by: string | null;
  player_id: string;
  is_keeper: boolean | null;
}
