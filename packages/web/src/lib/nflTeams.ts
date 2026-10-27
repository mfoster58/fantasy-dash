/**
 * NFL team names and banner colours, keyed by the player database's team codes. From nflverse teams_colors_logos (2026);
 * the stripe is the team's second colour, or a lighter one where that is too dark to show on the banner.
 */
export interface NflTeam { name: string; primary: string; stripe: string }

export const NFL_TEAMS: Readonly<Record<string, NflTeam>> = {
  ARI: { name: 'Arizona Cardinals', primary: '#97233F', stripe: '#FFB612' },
  ATL: { name: 'Atlanta Falcons', primary: '#A71930', stripe: '#A5ACAF' },
  BAL: { name: 'Baltimore Ravens', primary: '#241773', stripe: '#9E7C0C' },
  BUF: { name: 'Buffalo Bills', primary: '#00338D', stripe: '#C60C30' },
  CAR: { name: 'Carolina Panthers', primary: '#0085CA', stripe: '#BFC0BF' },
  CHI: { name: 'Chicago Bears', primary: '#0B162A', stripe: '#E64100' },
  CIN: { name: 'Cincinnati Bengals', primary: '#FB4F14', stripe: '#D32F1E' },
  CLE: { name: 'Cleveland Browns', primary: '#FF3C00', stripe: '#A5ACAF' },
  DAL: { name: 'Dallas Cowboys', primary: '#002244', stripe: '#B0B7BC' },
  DEN: { name: 'Denver Broncos', primary: '#002244', stripe: '#FB4F14' },
  DET: { name: 'Detroit Lions', primary: '#0076B6', stripe: '#B0B7BC' },
  GB: { name: 'Green Bay Packers', primary: '#203731', stripe: '#FFB612' },
  HOU: { name: 'Houston Texans', primary: '#03202F', stripe: '#A71930' },
  IND: { name: 'Indianapolis Colts', primary: '#002C5F', stripe: '#A5ACAF' },
  JAX: { name: 'Jacksonville Jaguars', primary: '#006778', stripe: '#9F792C' },
  KC: { name: 'Kansas City Chiefs', primary: '#E31837', stripe: '#FFB612' },
  LAC: { name: 'Los Angeles Chargers', primary: '#007BC7', stripe: '#FFC20E' },
  LAR: { name: 'Los Angeles Rams', primary: '#003594', stripe: '#FFD100' },
  LV: { name: 'Las Vegas Raiders', primary: '#000000', stripe: '#A5ACAF' },
  MIA: { name: 'Miami Dolphins', primary: '#008E97', stripe: '#F58220' },
  MIN: { name: 'Minnesota Vikings', primary: '#4F2683', stripe: '#FFC62F' },
  NE: { name: 'New England Patriots', primary: '#002244', stripe: '#C60C30' },
  NO: { name: 'New Orleans Saints', primary: '#D3BC8D', stripe: '#9F8958' },
  NYG: { name: 'New York Giants', primary: '#0B2265', stripe: '#A71930' },
  NYJ: { name: 'New York Jets', primary: '#003F2D', stripe: '#C9D1DB' },
  PHI: { name: 'Philadelphia Eagles', primary: '#004C54', stripe: '#A5ACAF' },
  PIT: { name: 'Pittsburgh Steelers', primary: '#000000', stripe: '#FFB612' },
  SEA: { name: 'Seattle Seahawks', primary: '#002244', stripe: '#69BE28' },
  SF: { name: 'San Francisco 49ers', primary: '#AA0000', stripe: '#B3995D' },
  TB: { name: 'Tampa Bay Buccaneers', primary: '#A71930', stripe: '#FF7900' },
  TEN: { name: 'Tennessee Titans', primary: '#4495D2', stripe: '#D50A0A' },
  WAS: { name: 'Washington Commanders', primary: '#5A1414', stripe: '#FFB612' },
};
