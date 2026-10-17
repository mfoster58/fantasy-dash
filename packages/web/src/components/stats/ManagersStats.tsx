import { Children, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import type { PlayerDirectory, Season } from '@fantasy-dash/core';
import { teamGamesOf } from '../../lib/managerGames';
import { managerRefs, regular, scopeSeasons, type Scope } from '../../lib/stats/scope';
import { eloFor, eloHistory } from '../../lib/stats/elo';
import { formGuide, scoringCalendar, standingsRace, weeklyFinishes } from '../../lib/stats/season';
import { consistency, postseasonForm, scheduleLuck, strengthOfSchedule } from '../../lib/stats/strength';
import { draftReturns, pointOrigins, rosterAge, wireActivity } from '../../lib/stats/roster';
import { moments } from '../../lib/stats/moments';
import { COLUMNS, statTable } from '../../lib/stats/table';
import StatCard from './StatCard';
import StatsToolbar from './StatsToolbar';
import StandingsRace from './StandingsRace';
import FormGuide from './FormGuide';
import ScoringCalendar from './ScoringCalendar';
import WeeklyFinishes from './WeeklyFinishes';
import PowerRating, { ELO_ABOUT } from './PowerRating';
import Consistency from './Consistency';
import ScheduleLuck from './ScheduleLuck';
import StrengthOfSchedule from './StrengthOfSchedule';
import PostseasonForm from './PostseasonForm';
import DraftReturns from './DraftReturns';
import PointOrigins from './PointOrigins';
import RosterAge from './RosterAge';
import WireActivity from './WireActivity';
import Moments from './Moments';
import StatTable from './StatTable';
import type { Pin } from './pin';

interface Props { seasons: Season[]; players: PlayerDirectory; years: number[]; currentYear: number }

const TABLE_ABOUT = COLUMNS.map((c) => `${c.label}: ${c.title}.`).join(' ');

/** one row of cards: two or three across from lg, one below; cards that are not for this view are passed as null and skipped */
function Row({ cols, children }: { cols: 1 | 2 | 3; children: ReactNode }) {
  const shown = Children.toArray(children);   // drops the nulls and falses
  if (shown.length === 0) return null;
  const grid = cols === 3 ? 'lg:grid-cols-3' : cols === 2 ? 'lg:grid-cols-2' : '';
  return <div className={`grid gap-4 ${grid}`}>{shown}</div>;
}

/** The Managers stats page: toolbar, then rows of chart cards and the table. The season and the pinned manager live in the URL. */
export default function ManagersStats({ seasons, players, years, currentYear }: Props) {
  const [params, setParams] = useSearchParams();
  const rawSeason = params.get('season');
  const scope: Scope = rawSeason === 'all' ? 'all' : years.includes(Number(rawSeason)) ? Number(rawSeason) : currentYear;
  const allTime = scope === 'all';
  const update = (mutate: (next: URLSearchParams) => void) => { const next = new URLSearchParams(params); mutate(next); setParams(next, { replace: true }); };

  const scoped = useMemo(() => scopeSeasons(seasons, scope), [seasons, scope]);
  const refs = useMemo(() => managerRefs(scoped), [scoped]);
  const pin: Pin = refs.some((r) => r.id === params.get('pin')) ? params.get('pin') : null;
  const single = allTime ? null : scoped[0] ?? null;
  const games = useMemo(() => teamGamesOf(scoped), [scoped]);
  const reg = useMemo(() => regular(games), [games]);
  const elo = useMemo(() => eloFor(eloHistory(seasons), scope), [seasons, scope]);
  const race = useMemo(() => (single ? standingsRace(single) : null), [single]);
  const form = useMemo(() => (single ? formGuide(single) : null), [single]);
  const calendar = useMemo(() => (single ? scoringCalendar(single) : null), [single]);
  const finishes = useMemo(() => weeklyFinishes(scoped), [scoped]);
  const spread = useMemo(() => consistency(reg), [reg]);
  const luck = useMemo(() => scheduleLuck(reg), [reg]);
  const sos = useMemo(() => strengthOfSchedule(reg), [reg]);
  const post = useMemo(() => postseasonForm(games), [games]);
  const draft = useMemo(() => (single ? draftReturns(single) : null), [single]);
  const origins = useMemo(() => pointOrigins(scoped), [scoped]);
  // the player directory describes the current season, so experience is rolled back to the season being viewed
  const age = useMemo(() => rosterAge(scoped, players, currentYear), [scoped, players, currentYear]);
  const wire = useMemo(() => (single ? wireActivity(single) : null), [single]);
  const moment = useMemo(() => moments(games), [games]);
  const table = useMemo(() => statTable(scoped), [scoped]);

  const toolbar = (
    <StatsToolbar years={years} season={scope} onSeason={(s) => update((n) => { if (s === currentYear) n.delete('season'); else n.set('season', String(s)); })}
      refs={refs} pin={pin} onPin={(id) => update((n) => { if (id) n.set('pin', id); else n.delete('pin'); })} />
  );
  if (games.length === 0) return <div className="space-y-6">{toolbar}<p className="text-sm text-muted">Season has not started.</p></div>;
  const through = single && single.status === 'in_season' ? ` Through week ${single.lastScoredWeek}.` : '';
  return (
    <div className="space-y-4">
      {toolbar}
      {allTime && <p className="text-sm text-muted">Pick a season for the week-by-week charts.</p>}
      <Row cols={2}>
        {race && <StatCard id="race" title="Standings race" caption="Each line is a manager; the dotted line is the playoff cut."><StandingsRace data={race} refs={refs} pin={pin} /></StatCard>}
        {form && <StatCard id="form" title="Form" caption="W and L squares; the dashed line is where the playoffs start; a gold dot marks the week's top score. Hover a square for the score."><FormGuide data={form} refs={refs} pin={pin} /></StatCard>}
      </Row>
      <Row cols={1}>
        <StatCard id="table" title="The numbers" wide about={TABLE_ABOUT} caption={`Every advanced stat; click a header to rank by it. Regular season unless the column says otherwise.${through}`}><StatTable rows={table} refs={refs} pin={pin} allTime={allTime} /></StatCard>
      </Row>
      <Row cols={2}>
        {calendar && <StatCard id="calendar" title="Scoring calendar" caption="Each week against the league average, playoffs after the dashed line: greener the further above, redder below."><ScoringCalendar data={calendar} refs={refs} pin={pin} /></StatCard>}
        <StatCard id="consistency" title="Consistency" caption="Box: second-worst to second-best week; tick: median; thin line: the full range. Short boxes are steady teams."><Consistency rows={spread} refs={refs} pin={pin} /></StatCard>
      </Row>
      <Row cols={1}>
        <StatCard id="elo" title="Power rating" wide about={ELO_ABOUT} caption={allTime ? 'Week by week across every season; each season starts a third of the way back toward 1500.' : 'Week by week, margin-aware Elo; pin a manager to lift his line.'}><PowerRating history={elo} refs={refs} pin={pin} /></StatCard>
      </Row>
      <Row cols={3}>
        <StatCard id="luck" title="Schedule luck" caption="Hollow dot: wins if you had played the league median every week. Filled dot: what the schedule gave you."><ScheduleLuck rows={luck} refs={refs} pin={pin} /></StatCard>
        <StatCard id="sos" title="Strength of schedule" caption="What opponents scored against each manager: red bars faced the hardest schedules, green the softest."><StrengthOfSchedule rows={sos} refs={refs} pin={pin} /></StatCard>
        {single && <StatCard id="post" title="Postseason form" caption="Hollow dot: regular-season average. Filled dot: postseason average, consolation games included."><PostseasonForm rows={post} refs={refs} pin={pin} /></StatCard>}
      </Row>
      <Row cols={1}>
        <StatCard id="age" title="Roster age" wide caption={age.estimated ? 'Average age behind each manager\'s started points; some ages are estimated from NFL seasons where the birth date is missing.' : 'Average age behind each manager\'s started points, weighted by the points each player scored.'}><RosterAge data={age} refs={refs} pin={pin} /></StatCard>
      </Row>
      <Row cols={2}>
        {single && <StatCard id="draft" title="Draft returns by round" caption="Points: started points from each manager's pick in each round. Value: what the pick was worth against its slot in the draft grading, green beat it, red fell short. Hover a cell for the player."><DraftReturns data={draft} players={players} refs={refs} pin={pin} /></StatCard>}
        {single && wire && <StatCard id="wire" title="Wire activity" caption="Waiver and free-agent adds per week; totals and FAAB spent on the right."><WireActivity data={wire} refs={refs} pin={pin} /></StatCard>}
      </Row>
      <Row cols={2}>
        <div className="grid gap-4">
          <StatCard id="finishes" title="Weekly finishes" caption="Green: weeks in the top three scorers. Red: weeks in the bottom three."><WeeklyFinishes rows={finishes} refs={refs} pin={pin} /></StatCard>
          <StatCard id="origins" title="Where the points came from" caption="Draft, pickups, trades; sorted by the share of points that did not come from the draft."><PointOrigins rows={origins} refs={refs} pin={pin} /></StatCard>
        </div>
        <StatCard id="moments" title="Notable matchups" caption="Winner on the left, loser on the right, the margin between. The bar splits at each side's share of the points; the tick is halfway. Each game opens its box score."><Moments data={moment} refs={refs} pin={pin} columns={1} /></StatCard>
      </Row>
    </div>
  );
}
