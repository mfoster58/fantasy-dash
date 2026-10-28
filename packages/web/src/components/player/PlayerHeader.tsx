import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import type { PlayerId } from '@fantasy-dash/core';
import PosPill from '../PosPill';
import { FinishIcon } from '../Icons';
import { ManagerLink, TeamLink } from '../NameLink';
import { players } from '../../data/load';
import { NFL_TEAMS } from '../../lib/nflTeams';
import { headshotUrl } from '../../lib/players';
import type { Bio } from '../../lib/player/bio';
import type { Stint } from '../../lib/player/journey';
import type { Summary } from '../../lib/player/seasons';

const Field = ({ label, value }: { label: string; value: string }) => (
  <div><div className="text-[10px] uppercase tracking-wider text-muted">{label}</div><div className="text-sm">{value}</div></div>
);
const Tile = ({ label, value, sub, testId }: { label: string; value: string; sub?: string; testId?: string }) => (
  <div data-testid={testId} className="rounded-lg border border-white/5 bg-bg/55 px-3 py-2 backdrop-blur-[2px]">
    <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    <div className="num text-xl font-semibold">{value}{sub && <span className="text-sm font-normal text-muted"> {sub}</span>}</div>
  </div>
);
const f1 = (v: number | null) => (v === null ? '–' : v.toFixed(1));

const espnHeadshot = (espnId: string) => `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`;
/** the full-size Sleeper headshot (a team logo for a defence) */
const sleeperHeadshot = (id: PlayerId) => (players[id]?.position === 'DEF' ? headshotUrl(players, id) : `https://sleepercdn.com/content/nfl/players/${id}.jpg`);
const teamLogo = (team: string) => `https://sleepercdn.com/images/team_logos/nfl/${team.toLowerCase()}.png`;

/**
 * ESPN's transparent headshot, standing on the banner; Sleeper's full-size one when there is no ESPN id or it fails,
 * then Sleeper's thumbnail; nothing when all fail. Keyed by player where it's used, so the next player starts from ESPN again.
 */
function Photo({ id, espnId }: { id: PlayerId; espnId: string | null }) {
  const sources = [...(espnId ? [espnHeadshot(espnId)] : []), sleeperHeadshot(id), ...(players[id]?.position === 'DEF' ? [] : [headshotUrl(players, id)])];
  const [at, setAt] = useState(0);
  if (at >= sources.length) return null;
  return (
    <img data-testid="banner-headshot" src={sources[at]} alt="" onError={() => setAt((n) => n + 1)}
      className="absolute bottom-0 left-0 h-full max-h-[240px] w-auto max-w-[calc(100%-14px)] object-contain object-bottom drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)] sm:left-2 sm:max-w-none" />
  );
}

/**
 * The player's banner, built like the game of the week: his whole headshot on the left, a stripe in his NFL team's second colour
 * and a thin gold one splitting it from his name, bio and league tiles, over a gradient from the team's colour.
 * A player without an NFL team gets the league's blue wash.
 * On a phone a smaller headshot sits top left with the bio beside it, and the name, team line and tiles run the full width
 * underneath (the body's wrappers dissolve with display: contents so their pieces join the banner's own grid).
 */
export default function PlayerHeader({ id, bio, summary, now, managerName, rostered, compareHref, espnId = null, posRank = null }: {
  id: PlayerId; bio: Bio; summary: Summary; now: Stint | null; managerName: string; rostered: boolean; compareHref?: string;
  espnId?: string | null;
  /** his position rank by points this season, e.g. WR1; null before he has one */
  posRank?: { label: string; year: number } | null;
}) {
  const fields: [string, string | null][] = [
    ['Age', bio.age === null ? null : String(bio.age)], ['Height', bio.height], ['Weight', bio.weight === null ? null : `${bio.weight} lb`],
    ['College', bio.college], ['NFL draft', bio.nflDraft],
  ];
  const shown = fields.filter((f): f is [string, string] => f[1] !== null);
  const team = NFL_TEAMS[bio.nflTeam];
  const style = team ? {
    '--team-primary': team.primary, '--team-stripe': team.stripe,
    background: `radial-gradient(80% 160% at 0% 0%, color-mix(in srgb, ${team.primary} 70%, transparent), transparent 70%), linear-gradient(115deg, color-mix(in srgb, ${team.primary} 55%, var(--surface)) 0%, color-mix(in srgb, ${team.primary} 18%, var(--surface)) 55%, var(--surface) 100%)`,
    borderColor: `color-mix(in srgb, ${team.stripe} 35%, var(--line))`,
  } as CSSProperties : undefined;

  return (
    <header data-testid="player-banner" data-team={team ? bio.nflTeam : undefined} style={style}
      className={`relative isolate grid grid-cols-[9.5rem_minmax(0,1fr)] overflow-hidden rounded-xl border border-line sm:flex sm:min-h-[230px] sm:flex-row ${team ? '' : 'blue-wash'}`}>
      {/* phones: a small photo top left with thinner stripes; wider: a panel down the left */}
      <div aria-hidden="true" className="relative col-start-1 row-start-1 min-h-[150px] w-[9.5rem] shrink-0 sm:h-auto sm:w-[390px] sm:self-stretch">
        <Photo key={`${id}-${espnId}`} id={id} espnId={espnId} />
        <div className="absolute -top-3.5 bottom-0 right-[13px] w-1.5 -skew-x-[11deg] sm:-bottom-3.5 sm:right-[22px] sm:w-2" style={{ background: team ? team.stripe : 'var(--accent)' }} />
        <div className="absolute -top-3.5 bottom-0 right-[5px] w-1 -skew-x-[11deg] bg-gold sm:-bottom-3.5 sm:right-2.5 sm:w-[5px]" />
      </div>
      <div className="contents min-w-0 flex-1 items-center gap-5 px-4 py-5 sm:grid sm:px-6 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div data-testid="banner-info" className="contents min-w-0 sm:relative sm:block">
          {/* the team logo, faint, behind the name and bio; -z-10 stays inside the banner's own stacking context */}
          {team && <img data-testid="team-watermark" aria-hidden="true" alt="" src={teamLogo(bio.nflTeam)} className="pointer-events-none absolute -left-4 top-1/2 -z-10 w-64 -translate-y-1/2 opacity-[0.08]" />}
          {team && <div className="col-span-2 px-4 pt-3 font-display text-xs font-bold uppercase tracking-[0.18em] sm:p-0" style={{ color: team.stripe }}>{team.name}</div>}
          <h1 className="col-span-2 mt-1.5 flex px-4 sm:px-0 flex-wrap items-center gap-x-2 gap-y-1 font-display text-3xl font-bold uppercase leading-[0.95] tracking-wide sm:text-[46px]">
            {bio.name}
            {summary.titles.map((y) => <FinishIcon key={y} kind="champion" size="0.7em" />)}
          </h1>
          <p className="col-span-2 mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 text-sm text-ink/85 sm:px-0">
            <PosPill pos={bio.pos} />
            {!team && bio.nflTeam && <span className="font-medium text-muted">{bio.nflTeam}</span>}
            <span>
              {now
                ? <>On <TeamLink userId={now.userId} year={now.lastYear} className="text-ink">{now.teamName}</TeamLink> (<ManagerLink userId={now.userId}>{managerName}</ManagerLink>)</>
                : rostered ? 'Free agent' : 'Never rostered in this league'}
              {summary.titles.length > 0 && ` · ${summary.titles.join(', ')} champion`}
            </span>
          </p>
          {/* on a phone the bio sits beside the photo, two across */}
          {shown.length > 0 && <div data-testid="bio" className="col-start-2 row-start-1 grid grid-cols-2 content-center gap-x-3 gap-y-2 py-3 pl-4 pr-3 sm:mt-3.5 sm:flex sm:flex-wrap sm:gap-x-6 sm:p-0">{shown.map(([l, v]) => <Field key={l} label={l} value={v} />)}</div>}
          {compareHref && <Link to={compareHref} className="col-span-2 mx-4 mt-3 inline-flex justify-self-start rounded-md sm:mx-0 border border-line bg-white/5 px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink">Compare</Link>}
        </div>
        {/* the league tiles, three across and two down */}
        {rostered && (
          <div data-testid="header-tiles" className="col-span-2 mt-4 grid grid-cols-2 gap-2 px-4 pb-4 sm:col-span-1 sm:mt-0 sm:grid-cols-3 sm:p-0 xl:w-[27rem] [&>*]:min-w-0">
            <Tile label="Points started" value={f1(summary.ptsStarted)} />
            <Tile label="Points / start" value={f1(summary.perStart)} />
            <Tile label="Starts" value={String(summary.starts)} sub={`/ ${summary.rostered}`} />
            <Tile label="Best week" value={f1(summary.best)} />
            <Tile label="W–L started" value={`${summary.w}–${summary.l}${summary.t ? `–${summary.t}` : ''}`} />
            <Tile testId="tile-posrank" label={posRank ? `Pos rank · ${posRank.year}` : 'Pos rank'} value={posRank?.label ?? '–'} />
          </div>
        )}
      </div>
    </header>
  );
}
