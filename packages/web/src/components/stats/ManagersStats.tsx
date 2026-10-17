import { useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import type { PlayerDirectory, Season } from '@fantasy-dash/core';
import { teamGamesOf } from '../../lib/managerGames';
import { managerRefs, regular, scopeSeasons, type Scope } from '../../lib/stats/scope';
import { eloFor, eloHistory } from '../../lib/stats/elo';
import { formGuide, scoringCalendar, standingsRace, weeklyFinishes } from '../../lib/stats/season';
import { allPlayGrid, consistency, postseasonForm, scheduleLuck, strengthOfSchedule } from '../../lib/stats/strength';
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
import AllPlayGrid from './AllPlayGrid';
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

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="section-label">{title}</h2>
      <div className="grid gap-4 lg:grid-cols-2">{children}</div>
    </section>
  );
}

/** The Managers stats page: toolbar, five groups of chart cards, the table. The season and the pinned manager live in the URL. */
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
  const grid = useMemo(() => allPlayGrid(reg, refs.map((r) => r.id)), [reg, refs]);
  const post = useMemo(() => postseasonForm(games), [games]);
  const draft = useMemo(() => (single ? draftReturns(single) : null), [single]);
  const origins = useMemo(() => pointOrigins(scoped), [scoped]);
  const age = useMemo(() => rosterAge(scoped, players), [scoped, players]);
  const wire = useMemo(() => (single ? wireActivity(single) : null), [single]);
  const moment = useMemo(() => moments(games), [games]);
  const table = useMemo(() => statTable(scoped), [scoped]);

  const toolbar = (
    <StatsToolbar years={years} season={scope} onSeason={(s) => update((n) => { if (s === currentYear) n.delete('season'); else n.set('season', String(s)); })}
      refs={refs} pin={pin} onPin={(id) => update((n) => { if (id) n.set('pin', id); else n.delete('pin'); })} />
  );
  if (games.length === 0) return <div className="space-y-6">{toolbar}<p className="text-sm text-muted">Season has not started.</p></div>;
  const through = single && single.status === 'in_season' ? ` Through week ${single.lastScoredWeek}.` : '';
  const weekNote = <p className="text-sm text-muted lg:col-span-2">Pick a season for the week-by-week charts.</p>;
  return (
    <div className="space-y-8">
      {toolbar}
      <Group title="The season">
        {race && form && calendar ? (
          <>
            <StatCard id="race" eyebrow="Place in the table after every week" title="Standings race" caption="Each line is a manager; the dotted line is the playoff cut."><StandingsRace data={race} refs={refs} pin={pin} /></StatCard>
            <StatCard id="finishes" eyebrow="How often each manager was a top or bottom scorer" title="Weekly finishes" caption="Green: weeks in the top three scorers. Red: weeks in the bottom three."><WeeklyFinishes rows={finishes} refs={refs} pin={pin} /></StatCard>
            <StatCard id="form" eyebrow="Every game, every manager, one glance" title="Form guide" wide caption="W and L squares; the dashed line is where the playoffs start; a gold dot marks the week's top score. Hover a square for the score."><FormGuide data={form} refs={refs} pin={pin} /></StatCard>
            <StatCard id="calendar" eyebrow="Each week against the league average" title="Scoring calendar" wide caption="Greener the further above the week's average, redder below."><ScoringCalendar data={calendar} refs={refs} pin={pin} /></StatCard>
          </>
        ) : (
          <>
            {weekNote}
            <StatCard id="finishes" eyebrow="How often each manager was a top or bottom scorer, every season" title="Weekly finishes" caption="Green: weeks in the top three scorers. Red: weeks in the bottom three."><WeeklyFinishes rows={finishes} refs={refs} pin={pin} /></StatCard>
          </>
        )}
      </Group>
      <Group title="Strength">
        <StatCard id="elo" eyebrow={allTime ? 'Week by week across every season' : 'Week by week, margin-aware Elo'} title="Power rating" wide about={ELO_ABOUT} caption={allTime ? 'One line per manager; each season starts a third of the way back toward 1500.' : 'One line per manager; the pinned one is bright, the rest fade.'}><PowerRating history={elo} refs={refs} pin={pin} /></StatCard>
        <StatCard id="consistency" eyebrow="Floor, median and ceiling week" title="Consistency" caption="Box: second-worst to second-best week; tick: median; thin line: the full range. Short boxes are steady teams."><Consistency rows={spread} refs={refs} pin={pin} /></StatCard>
        <StatCard id="luck" eyebrow="Real record against the record versus the median" title="Schedule luck" caption="Hollow dot: wins if you had played the league median every week. Filled dot: what the schedule gave you."><ScheduleLuck rows={luck} refs={refs} pin={pin} /></StatCard>
        <StatCard id="sos" eyebrow="What opponents scored against each manager" title="Strength of schedule" caption="Red bars faced the hardest schedules, green the softest."><StrengthOfSchedule rows={sos} refs={refs} pin={pin} /></StatCard>
        {single && <StatCard id="post" eyebrow="Regular-season scoring against the postseason" title="Postseason form" caption="Hollow dot: regular-season average. Filled dot: postseason average, consolation games included."><PostseasonForm rows={post} refs={refs} pin={pin} /></StatCard>}
        <StatCard id="h2h" eyebrow="Who outscores whom, every week counted" title="Head to head" wide caption="Row beats column: every week counts as if the two had played, not only the real matchups, which are in the hover."><AllPlayGrid grid={grid} refs={refs} pin={pin} /></StatCard>
      </Group>
      <Group title="Roster">
        {single && <StatCard id="draft" eyebrow="Started points from each manager's pick in each round" title="Draft returns by round" wide caption="Brighter is more; hover a cell for the player. A bright late cell is a steal."><DraftReturns data={draft} players={players} refs={refs} pin={pin} /></StatCard>}
        <StatCard id="origins" eyebrow="Draft, pickups, trades" title="Where the points came from" caption="Sorted by the share of points that did not come from the draft."><PointOrigins rows={origins} refs={refs} pin={pin} /></StatCard>
        <StatCard id="age" eyebrow="Average age behind each manager's started points" title="Roster age" caption={age.estimated ? 'Some ages are estimated from NFL seasons where the birth date is missing.' : 'Weighted by the points each player scored.'}><RosterAge data={age} refs={refs} pin={pin} /></StatCard>
        {single && wire && <StatCard id="wire" eyebrow="Pickups per week, per manager" title="Wire activity" wide caption="Waiver and free-agent adds; totals and FAAB spent on the right."><WireActivity data={wire} refs={refs} pin={pin} /></StatCard>}
      </Group>
      <Group title="Moments">
        <StatCard id="moments" eyebrow="The injustices and demolitions" title="Robbed, stolen, flattened" wide caption="Highest score in a loss, lowest score in a win, biggest margins, closest calls. Each row opens the box score."><Moments data={moment} refs={refs} pin={pin} /></StatCard>
      </Group>
      <Group title="By the numbers">
        <StatCard id="table" eyebrow="Every advanced stat, click a header to rank by it" title="The numbers" wide about={TABLE_ABOUT} caption={`Regular season unless the column says otherwise.${through}`}><StatTable rows={table} refs={refs} pin={pin} allTime={allTime} /></StatCard>
      </Group>
    </div>
  );
}
