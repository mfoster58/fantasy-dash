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

/** ESPN's transparent headshot, standing on the banner; Sleeper's when there is no ESPN id or it fails; nothing when both fail. */
function Photo({ id, espnId }: { id: PlayerId; espnId: string | null }) {
  const sources = [...(espnId ? [espnHeadshot(espnId)] : []), sleeperHeadshot(id)];
  const [at, setAt] = useState(0);
  if (at >= sources.length) return null;
  return (
    <img data-testid="banner-headshot" src={sources[at]} alt="" onError={() => setAt((n) => n + 1)}
      className="absolute bottom-0 left-2 h-full max-h-[240px] w-auto object-contain object-bottom drop-shadow-[0_6px_18px_rgba(0,0,0,0.45)]" />
  );
}

/**
 * The player's banner, built like the game of the week: his whole headshot on the left, a stripe in his NFL team's second colour
 * and a thin gold one splitting it from his name, bio and league tiles, over a gradient from the team's colour.
 * A player without an NFL team gets the league's blue wash.
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
      className={`relative isolate flex min-h-[230px] flex-col overflow-hidden rounded-xl border border-line sm:flex-row ${team ? '' : 'blue-wash'}`}>
      {team && <img aria-hidden="true" alt="" src={teamLogo(bio.nflTeam)} className="pointer-events-none absolute -right-8 top-1/2 -z-10 w-72 -translate-y-1/2 opacity-[0.07]" />}
      {/* phones: the photo and stripes are a band across the top; wider: a panel down the left */}
      <div aria-hidden="true" className="relative h-44 w-[260px] shrink-0 sm:h-auto sm:w-[390px] sm:self-stretch">
        <Photo id={id} espnId={espnId} />
        <div className="absolute -inset-y-3.5 right-[22px] w-2 -skew-x-[11deg]" style={{ background: team ? team.stripe : 'var(--accent)' }} />
        <div className="absolute -inset-y-3.5 right-2.5 w-[5px] -skew-x-[11deg] bg-gold" />
      </div>
      <div className="grid min-w-0 flex-1 items-center gap-5 px-4 py-5 sm:px-6 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          {team && <div className="font-display text-xs font-bold uppercase tracking-[0.18em]" style={{ color: team.stripe }}>{team.name}</div>}
          <h1 className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-3xl font-bold uppercase leading-[0.95] tracking-wide sm:text-[46px]">
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
          {shown.length > 0 && <div className="mt-3.5 flex flex-wrap gap-x-6 gap-y-2">{shown.map(([l, v]) => <Field key={l} label={l} value={v} />)}</div>}
          {compareHref && <Link to={compareHref} className="mt-3 inline-flex rounded-md border border-line bg-white/5 px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink">Compare</Link>}
        </div>
        {/* the league tiles, three across and two down */}
        {rostered && (
          <div data-testid="header-tiles" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:w-[27rem] [&>*]:min-w-0">
            <Tile label="Points started" value={f1(summary.ptsStarted)} />
            <Tile label="Points / start" value={f1(summary.perStart)} />
            <Tile label="Starts" value={String(summary.starts)} sub={`/ ${summary.rostered}`} />
            <Tile label="Best week" value={f1(summary.best)} />
            <Tile label="Team W–L started" value={`${summary.w}–${summary.l}${summary.t ? `–${summary.t}` : ''}`} />
            <Tile testId="tile-posrank" label={posRank ? `Pos rank · ${posRank.year}` : 'Pos rank'} value={posRank?.label ?? '–'} />
          </div>
        )}
      </div>
    </header>
  );
}
