export const leagueConfig = {
  leagueId: '1388299227519537152',
  name: 'Husky Fantasy',
  /** Optional display-name overrides keyed by Sleeper user_id. */
  managerNames: {} as Record<string, string>,
  /** Position overrides keyed by Sleeper player_id, for players Sleeper files under the wrong fantasy position. */
  positionOverrides: {
    '12530': 'WR', // Travis Hunter (Sleeper lists him as DB)
  } as Record<string, string>,
};
