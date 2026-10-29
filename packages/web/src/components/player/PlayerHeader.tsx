import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import type { PlayerId } from '@fantasy-dash/core';
import PosPill from '../PosPill';
import { FinishIcon } from '../Icons';
import { ManagerLink, TeamLink } from '../NameLink';
import { players } from '../../data/load';
import { NFL_TEAMS, type NflTeam } from '../../lib/nflTeams';
import { headshotUrl, posColor } from '../../lib/players';
import { useIsPhone } from '../../lib/useIsPhone';
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
/** standing on the wide banner's left panel */
const PHOTO = 'absolute bottom-0 left-2 h-full max-h-[240px] w-auto object-contain object-bottom drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]';
const teamLogo = (team: string) => `https://sleepercdn.com/images/team_logos/nfl/${team.toLowerCase()}.png`;

/**
 * ESPN's transparent headshot, standing on the banner; Sleeper's full-size one when there is no ESPN id or it fails,
 * then Sleeper's thumbnail; nothing when all fail. Keyed by player where it's used, so the next player starts from ESPN again.
 */
function Photo({ id, espnId, className = PHOTO }: { id: PlayerId; espnId: string | null; className?: string }) {
  const sources = [...(espnId ? [espnHeadshot(espnId)] : []), sleeperHeadshot(id), ...(players[id]?.position === 'DEF' ? [] : [headshotUrl(players, id)])];
  const [at, setAt] = useState(0);
  if (at >= sources.length) return null;
  return (
    <img data-testid="banner-headshot" src={sources[at]} alt="" onError={() => setAt((n) => n + 1)}
      className={className} />
  );
}

/** the six league numbers, as boxed tiles on a wide screen or an open strip on a phone */
function leagueTiles(summary: Summary, posRank: { label: string; year: number } | null, Cell: typeof Tile) {
  return [
    <Cell key="pts" label="Points started" value={f1(summary.ptsStarted)} />,
    <Cell key="per" label="Points / start" value={f1(summary.perStart)} />,
    <Cell key="starts" label="Starts" value={String(summary.starts)} sub={`/ ${summary.rostered}`} />,
    <Cell key="best" label="Best week" value={f1(summary.best)} />,
    <Cell key="wl" label="W–L started" value={`${summary.w}–${summary.l}${summary.t ? `–${summary.t}` : ''}`} />,
    <Cell key="rank" testId="tile-posrank" label={posRank ? `Pos rank · ${posRank.year}` : 'Pos rank'} value={posRank?.label ?? '–'} />,
  ];
}

/** a phone's stat: no box, just the label over a big number, with room around it */
const OpenTile = ({ label, value, sub, testId }: { label: string; value: string; sub?: string; testId?: string }) => (
  <div data-testid={testId} className="min-w-0">
    <div className="truncate text-[10.5px] font-semibold uppercase tracking-wider text-muted">{label}</div>
    <div className="num mt-0.5 text-[19px] font-bold leading-tight">{value}{sub && <span className="text-xs font-normal text-muted"> {sub}</span>}</div>
  </div>
);

type HeaderProps = {
  id: PlayerId; bio: Bio; summary: Summary; now: Stint | null; managerName: string; rostered: boolean; compareHref?: string;
  espnId?: string | null;
  /** his position rank by points this season, e.g. WR1; null before he has one */
  posRank?: { label: string; year: number } | null;
};

/** the banner's background: a gradient from his NFL team's colour, or nothing for the league's blue wash */
const teamStyle = (team: NflTeam | undefined) => (team ? {
  '--team-primary': team.primary, '--team-stripe': team.stripe,
  background: `radial-gradient(80% 160% at 0% 0%, color-mix(in srgb, ${team.primary} 70%, transparent), transparent 70%), linear-gradient(115deg, color-mix(in srgb, ${team.primary} 55%, var(--surface)) 0%, color-mix(in srgb, ${team.primary} 18%, var(--surface)) 55%, var(--surface) 100%)`,
  borderColor: `color-mix(in srgb, ${team.stripe} 35%, var(--line))`,
} as CSSProperties : undefined);

/** a phone's header, after an app's player card: the photo over a big faint team logo, the team and position under it;
 * the manager, the name on two lines and the bio beside it; then the league numbers in an open strip */
function PhoneHeader({ id, bio, summary, now, managerName, rostered, compareHref, espnId = null, posRank = null }: HeaderProps) {
  const team = NFL_TEAMS[bio.nflTeam];
  const [first, ...rest] = bio.name.split(' ');
  const last = rest.join(' ');
  const bioRow = [['Age', bio.age === null ? null : String(bio.age)], ['Height', bio.height], ['Weight', bio.weight === null ? null : `${bio.weight} lb`]]
    .filter((f): f is [string, string] => f[1] !== null);
  const more = [bio.college, bio.nflDraft].filter(Boolean).join(' · ');
  return (
    <header data-testid="player-banner" data-layout="phone" data-team={team ? bio.nflTeam : undefined} style={teamStyle(team)}
      className={`relative isolate overflow-hidden rounded-xl border border-line ${team ? '' : 'blue-wash'}`}>
      <div className="grid grid-cols-[40%_minmax(0,1fr)] gap-x-4 px-4 pt-4">
        <div data-testid="photo-side" className="relative flex flex-col">
          {team && <img data-testid="team-watermark" aria-hidden="true" alt="" src={teamLogo(bio.nflTeam)} className="pointer-events-none absolute -left-6 top-0 -z-10 w-[125%] opacity-25" />}
          <div aria-hidden="true" className="relative h-[132px]">
            <Photo key={`${id}-${espnId}`} id={id} espnId={espnId} className="absolute bottom-0 left-1/2 h-full w-auto max-w-none -translate-x-1/2 object-contain object-bottom drop-shadow-[0_6px_14px_rgba(0,0,0,0.45)]" />
          </div>
          <div className="-mx-4 bg-black/30 px-2 py-1.5 text-center">
            {team && <div className="font-display text-[17px] font-bold uppercase leading-none tracking-wide">{team.name.split(' ').pop()}</div>}
            <div className="mt-0.5 text-[11px] font-semibold"><span style={{ color: posColor(bio.pos) }}>{bio.pos}</span>{bio.nflTeam && <span className="text-ink/80"> • {bio.nflTeam}</span>}</div>
          </div>
        </div>
        <div className="min-w-0 pb-3">
          <div className="truncate text-xs text-ink/80">
            {now
              ? <><span aria-hidden="true" className="text-accent">→ </span><ManagerLink userId={now.userId} className="text-accent">{managerName}</ManagerLink></>
              : rostered ? 'Free agent' : 'Never rostered here'}
          </div>
          <h1 className="mt-1 font-display font-bold uppercase leading-[0.95] tracking-wide">
            <span data-name-part className="block truncate text-[22px]">{first}</span>
            {last && <span data-name-part className="block truncate text-[26px]">{last}</span>}
            {summary.titles.length > 0 && <span className="mt-1 flex gap-1">{summary.titles.map((y) => <FinishIcon key={y} kind="champion" size="0.75em" />)}</span>}
          </h1>
          {bioRow.length > 0 && (
            <div data-testid="bio" className="mt-3 grid grid-cols-3 gap-x-2">
              {bioRow.map(([l, v]) => (
                <div key={l} className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{l}</div>
                  <div className="num truncate text-[15px] font-bold">{v}</div>
                </div>
              ))}
            </div>
          )}
          {more && <div className="mt-1.5 truncate text-[11px] text-muted">{more}</div>}
          {compareHref && <Link to={compareHref} className="mt-3 inline-flex h-9 items-center rounded-full bg-white/10 px-5 text-sm font-semibold hover:bg-white/15">Compare</Link>}
        </div>
      </div>
      {rostered && (
        <div data-testid="header-tiles" className="grid grid-cols-3 gap-x-3 gap-y-4 border-t border-white/10 bg-bg/25 px-4 py-4">
          {leagueTiles(summary, posRank, OpenTile)}
        </div>
      )}
    </header>
  );
}

/**
 * The player's banner, built like the game of the week: his whole headshot on the left, a stripe in his NFL team's second colour
 * and a thin gold one splitting it from his name, bio and league tiles, over a gradient from the team's colour.
 * A player without an NFL team gets the league's blue wash. A phone gets its own compact header.
 */
export default function PlayerHeader(props: HeaderProps) {
  const phone = useIsPhone();
  if (phone) return <PhoneHeader {...props} />;
  const { id, bio, summary, now, managerName, rostered, compareHref, espnId = null, posRank = null } = props;
  const fields: [string, string | null][] = [
    ['Age', bio.age === null ? null : String(bio.age)], ['Height', bio.height], ['Weight', bio.weight === null ? null : `${bio.weight} lb`],
    ['College', bio.college], ['NFL draft', bio.nflDraft],
  ];
  const shown = fields.filter((f): f is [string, string] => f[1] !== null);
  const team = NFL_TEAMS[bio.nflTeam];

  return (
    <header data-testid="player-banner" data-team={team ? bio.nflTeam : undefined} style={teamStyle(team)}
      className={`relative isolate flex min-h-[230px] overflow-hidden rounded-xl border border-line ${team ? '' : 'blue-wash'}`}>
      <div aria-hidden="true" className="relative w-[390px] shrink-0 self-stretch">
        <Photo key={`${id}-${espnId}`} id={id} espnId={espnId} />
        <div className="absolute -inset-y-3.5 right-[22px] w-2 -skew-x-[11deg]" style={{ background: team ? team.stripe : 'var(--accent)' }} />
        <div className="absolute -inset-y-3.5 right-2.5 w-[5px] -skew-x-[11deg] bg-gold" />
      </div>
      <div className="grid min-w-0 flex-1 items-center gap-5 px-6 py-5 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div data-testid="banner-info" className="relative min-w-0">
          {/* the team logo, faint, behind the name and bio; -z-10 stays inside the banner's own stacking context */}
          {team && <img data-testid="team-watermark" aria-hidden="true" alt="" src={teamLogo(bio.nflTeam)} className="pointer-events-none absolute -left-4 top-1/2 -z-10 w-64 -translate-y-1/2 opacity-[0.08]" />}
          {team && <div className="font-display text-xs font-bold uppercase tracking-[0.18em]" style={{ color: team.stripe }}>{team.name}</div>}
          <h1 className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-[46px] font-bold uppercase leading-[0.95] tracking-wide">
            {bio.name}
            {summary.titles.map((y) => <FinishIcon key={y} kind="champion" size="0.7em" />)}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-ink/85">
            <PosPill pos={bio.pos} />
            {!team && bio.nflTeam && <span className="font-medium text-muted">{bio.nflTeam}</span>}
            <span>
              {now
                ? <>On <TeamLink userId={now.userId} year={now.lastYear} className="text-ink">{now.teamName}</TeamLink> (<ManagerLink userId={now.userId}>{managerName}</ManagerLink>)</>
                : rostered ? 'Free agent' : 'Never rostered in this league'}
              {summary.titles.length > 0 && ` · ${summary.titles.join(', ')} champion`}
            </span>
          </p>
          {shown.length > 0 && <div data-testid="bio" className="mt-3.5 flex flex-wrap gap-x-6 gap-y-2">{shown.map(([l, v]) => <Field key={l} label={l} value={v} />)}</div>}
          {compareHref && <Link to={compareHref} className="mt-3 inline-flex rounded-md border border-line bg-white/5 px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink">Compare</Link>}
        </div>
        {/* the league tiles, three across and two down */}
        {rostered && (
          <div data-testid="header-tiles" className="grid grid-cols-3 gap-2 xl:w-[27rem] [&>*]:min-w-0">
            {leagueTiles(summary, posRank, Tile)}
          </div>
        )}
      </div>
    </header>
  );
}
