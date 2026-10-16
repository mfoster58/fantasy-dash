import type { Tab } from './shared';

export interface SubTab {
  id: string;
  tab: Tab;
  title: string;
  /** fixed note under the title; null means the season note ("Every season" / "2024 season") */
  note: string | null;
  columns: 2 | 3;
  /** season picker default: the current season, All-time, or no picker */
  picker: 'current' | 'all' | null;
  /** shows the position filter */
  positions: boolean;
}

export const TABS: { id: Tab; title: string }[] = [{ id: 'players', title: 'Players' }, { id: 'managers', title: 'Managers' }];

export const SUB_TABS: SubTab[] = [
  { id: 'alltime', tab: 'players', title: 'All-time', note: null, columns: 2, picker: 'all', positions: true },
  { id: 'moments', tab: 'players', title: 'Moments', note: null, columns: 2, picker: 'all', positions: true },
  { id: 'streaks', tab: 'players', title: 'Streaks', note: 'Every season', columns: 2, picker: null, positions: true },
  { id: 'postseason', tab: 'players', title: 'Postseason', note: 'Championship bracket unless the board says otherwise', columns: 2, picker: null, positions: true },
  { id: 'leaders', tab: 'players', title: 'Leaders', note: null, columns: 3, picker: 'current', positions: true },
  { id: 'malltime', tab: 'managers', title: 'All-time', note: 'Every season', columns: 2, picker: null, positions: false },
  { id: 'mseasons', tab: 'managers', title: 'Seasons', note: null, columns: 2, picker: 'all', positions: false },
  { id: 'mgames', tab: 'managers', title: 'Games', note: null, columns: 2, picker: 'all', positions: false },
  { id: 'mstreaks', tab: 'managers', title: 'Streaks', note: 'Every season', columns: 2, picker: null, positions: false },
  { id: 'mplayoffs', tab: 'managers', title: 'Playoffs', note: 'Championship bracket unless the board says otherwise', columns: 2, picker: null, positions: false },
  { id: 'mdraft', tab: 'managers', title: 'Draft', note: null, columns: 2, picker: 'all', positions: false },
  { id: 'mtransactions', tab: 'managers', title: 'Transactions', note: null, columns: 2, picker: 'all', positions: false },
];

export const subTabsOf = (tab: Tab): SubTab[] => SUB_TABS.filter((s) => s.tab === tab);
