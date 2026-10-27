import type { PosGroup } from '../compare/url';

/** The chart cards; `throws` is the QB's route tree of his throws. */
export type ChartKind = 'lanes' | 'routes' | 'targets' | 'zones' | 'pressure' | 'throws';

export interface ChartControls {
  label: string;
  /** the filter segment's label; null for a chart with no filter */
  filterLabel: string | null;
  filters: [string, string][];
  metrics: [string, string][];
}

/** Every card's filter and metric options, shared by the cards and the compare page's control bar. */
export const CHART_CONTROLS: Record<ChartKind, ChartControls> = {
  lanes: { label: 'Run lanes', filterLabel: 'Box', filters: [['all', 'All'], ['light', 'Light box (≤6)'], ['heavy', 'Heavy box (7+)']], metrics: [['share', 'Carry share'], ['ypc', 'Yds/carry'], ['succ', 'Success %'], ['epa', 'EPA/carry']] },
  routes: { label: 'Route tree', filterLabel: 'Coverage', filters: [['all', 'All'], ['man', 'vs Man'], ['zone', 'vs Zone']], metrics: [['share', 'Target share'], ['ypt', 'Yds/tgt'], ['catch', 'Catch %'], ['epa', 'EPA/tgt']] },
  throws: { label: 'Throws by route', filterLabel: 'Coverage', filters: [['all', 'All'], ['man', 'vs Man'], ['zone', 'vs Zone']], metrics: [['share', 'Throw share'], ['comp', 'Comp %'], ['ypa', 'Yds/att'], ['epa', 'EPA/att']] },
  targets: { label: 'Target map', filterLabel: 'Plays', filters: [['all', 'All'], ['pa', 'Play-action'], ['nopa', 'No play-action'], ['motion', 'Motion'], ['screen', 'Screen'], ['blitz', 'vs blitz'], ['contested', 'Contested']], metrics: [['share', 'Target share'], ['catch', 'Catch %'], ['ypt', 'Yds/target'], ['epa', 'EPA/target']] },
  zones: { label: 'Passing zones', filterLabel: 'Pocket', filters: [['all', 'All'], ['clean', 'Clean pocket'], ['pressured', 'Pressured']], metrics: [['share', 'Throw share'], ['comp', 'Comp %'], ['ypa', 'Yds/att'], ['epa', 'EPA/att'], ['cpoe', 'CPOE']] },
  pressure: { label: 'Under pressure', filterLabel: null, filters: [['all', 'All']], metrics: [['epa', 'EPA/dropback'], ['comp', 'Comp %'], ['ypa', 'Yds/att'], ['sack', 'Sack %']] },
};

export const CHARTS_BY_GROUP: Record<PosGroup, ChartKind[]> = { QB: ['zones', 'pressure', 'throws'], RB: ['lanes', 'routes', 'targets'], WRTE: ['routes', 'targets'] };

/** Season, filter and metric handed to a card by the compare page; the card then hides its own picker and controls. */
export interface ChartControl { year: number; filter: string; metric: string }
