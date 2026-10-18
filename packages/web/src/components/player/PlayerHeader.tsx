import type { PlayerId } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { FinishIcon } from '../Icons';
import { ManagerLink, TeamLink } from '../NameLink';
import { players } from '../../data/load';
import type { Bio } from '../../lib/player/bio';
import type { Stint } from '../../lib/player/journey';
import type { Summary } from '../../lib/player/seasons';

const Field = ({ label, value }: { label: string; value: string }) => (
  <div><div className="text-[10px] uppercase tracking-wider text-muted">{label}</div><div className="text-sm">{value}</div></div>
);
const Tile = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-lg bg-surface-2 px-3 py-2">
    <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
    <div className="num text-xl font-semibold">{value}{sub && <span className="text-sm font-normal text-muted"> {sub}</span>}</div>
  </div>
);
const f1 = (v: number | null) => (v === null ? '–' : v.toFixed(1));

/** Name, trophies, position and team; who has him now; bio fields; and, for a player who was rostered, the league tiles. */
export default function PlayerHeader({ id, bio, summary, now, managerName, rostered }: { id: PlayerId; bio: Bio; summary: Summary; now: Stint | null; managerName: string; rostered: boolean }) {
  const fields: [string, string | null][] = [
    ['Age', bio.age === null ? null : String(bio.age)], ['Height', bio.height], ['Weight', bio.weight === null ? null : `${bio.weight} lb`],
    ['College', bio.college], ['NFL draft', bio.nflDraft],
  ];
  const shown = fields.filter((f): f is [string, string] => f[1] !== null);
  return (
    <header className="space-y-4">
      <div className="flex items-center gap-4">
        <Headshot players={players} id={id} size={84} />
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {bio.name}
            {summary.titles.map((y) => <FinishIcon key={y} kind="champion" size="0.9em" />)}
            <PosPill pos={bio.pos} />
            {bio.nflTeam && <span className="text-base font-medium text-muted">{bio.nflTeam}</span>}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {now
              ? <>On <TeamLink userId={now.userId} year={now.lastYear} className="text-ink">{now.teamName}</TeamLink> (<ManagerLink userId={now.userId}>{managerName}</ManagerLink>)</>
              : rostered ? 'Free agent' : 'Never rostered in this league'}
            {summary.titles.length > 0 && ` · ${summary.titles.join(', ')} champion`}
          </p>
        </div>
      </div>
      {shown.length > 0 && <div className="flex flex-wrap gap-x-8 gap-y-2">{shown.map(([l, v]) => <Field key={l} label={l} value={v} />)}</div>}
      {rostered && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Tile label="Points started" value={f1(summary.ptsStarted)} />
          <Tile label="Points / start" value={f1(summary.perStart)} />
          <Tile label="Starts" value={String(summary.starts)} sub={`/ ${summary.rostered}`} />
          <Tile label="Best week" value={f1(summary.best)} />
          <Tile label="Team W–L started" value={`${summary.w}–${summary.l}${summary.t ? `–${summary.t}` : ''}`} />
          <Tile label="Managers" value={String(summary.managers)} />
        </div>
      )}
    </header>
  );
}
