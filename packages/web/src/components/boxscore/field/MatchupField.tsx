import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameSide, PlayerDirectory, PlayerId } from '@fantasy-dash/core';
import { liveDrives } from '../../../lib/field/drives';
import type { EspnPlay } from '../../../lib/field/espnGame';
import { readPlays, type FieldPlay, type Starter } from '../../../lib/field/readPlays';
import { useGameFeeds } from '../../../lib/field/useGameFeeds';
import type { NflGame } from '../../../lib/live/espn';
import { headshotUrl, playerTeam } from '../../../lib/players';
import { logoUrl } from '../../stats/players/TeamLogo';
import FieldSide, { type FieldStarter } from './FieldSide';

const COLOR = ['var(--accent)', 'var(--coral)'] as const;
const SIDE = ['a', 'b'] as const;
/** how long a touchdown celebration plays */
const CELEBRATE_MS = 3000;
const sign = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;
const keyOf = (p: FieldPlay) => `${p.id}:${p.pid}`;

/** "Concepcion 32-yd catch" */
export function describe(p: FieldPlay, short: string): string {
  switch (p.kind) {
    case 'rec': return `${short} ${p.gain}-yd ${p.td ? 'TD catch' : 'catch'}`;
    case 'inc': return `${short} target, incomplete`;
    case 'run': return `${short} ${p.gain}-yd ${p.td ? 'TD run' : 'run'}`;
    case 'pass': return `${short} ${p.gain}-yd ${p.td ? 'TD pass' : 'completion'}`;
    case 'passinc': return `${short} incomplete`;
    case 'int': return `${short} intercepted`;
  }
}

/**
 * Both lineups' plays from ESPN's play-by-play, each offense going up its own field. While games are on it opens on
 * the drives happening now and keeps itself current; new plays draw themselves in and a touchdown gets its moment.
 */
export default function MatchupField({ sides, names, players, scoring, games, seasonTeams, fetcher }: {
  sides: [GameSide, GameSide];
  names: [string, string];
  players: PlayerDirectory;
  scoring: Record<string, number>;
  /** this week's NFL games from ESPN's scoreboard */
  games: NflGame[] | null;
  seasonTeams?: Record<PlayerId, string>;
  fetcher?: (url: string) => Promise<Response>;
}) {
  // each side's starters who can make a play: no kickers or defences
  const starters = useMemo(() => sides.map((s) => s.starters.flatMap(({ player }) => {
    const p = player && players[player.playerId];
    if (!player || !p || p.position === 'K' || p.position === 'DEF') return [];
    const team = playerTeam(players, player.playerId, seasonTeams);
    const fs: FieldStarter & Starter = {
      id: player.playerId, name: p.name, short: p.lastName.replace(/ (Jr\.|Sr\.|II|III|IV|V)$/, '') || p.name, pos: p.position ?? 'WR',
      img: headshotUrl(players, player.playerId), points: player.points, firstName: p.firstName ?? '', lastName: p.lastName ?? '', team,
    };
    return [fs];
  })), [sides, players, seasonTeams]);
  const teams = useMemo(() => starters.map((list) => new Set(list.map((s) => s.team))), [starters]);
  const relevant = useMemo(() => (games ?? []).filter((g) => g.id && g.state !== 'pre' && g.teams.some((t) => teams[0].has(t) || teams[1].has(t))), [games, teams]);
  const feeds = useGameFeeds(relevant.map((g) => ({ id: g.id!, state: g.state })), fetcher ? { fetcher } : undefined);
  const feedList = useMemo(() => relevant.flatMap((g) => (feeds[g.id!] ? [feeds[g.id!]] : [])), [relevant, feeds]);
  const plays = useMemo(() => starters.map((list) => feedList.flatMap((f) => readPlays(f, list, scoring)).sort((x, y) => (x.time ?? 0) - (y.time ?? 0))), [feedList, starters, scoring]);

  const anyLive = relevant.some((g) => g.state === 'in');
  const [picked, setPicked] = useState<'live' | 'week' | null>(null);
  const mode = picked ?? (anyLive ? 'live' : 'week');
  const [focus, setFocus] = useState<[string | null, string | null]>([null, null]);

  // a drive that scored stays up a few seconds: look again every few seconds while games are on
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!anyLive) return;
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, [anyLive]);
  const drives = useMemo(() => (mode === 'live' ? teams.map((t) => liveDrives(feedList, t, now)) : [[], []]), [mode, teams, feedList, now]);

  // plays already there at the first look are drawn as they are; anything after draws itself in, and a touchdown is celebrated
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [party, setParty] = useState<[FieldPlay | null, FieldPlay | null]>([null, null]);
  useEffect(() => {
    if (!feedList.length) return;
    const all = plays.flat();
    if (!seen.current) { seen.current = new Set(all.map(keyOf)); return; }
    const added = all.filter((p) => !seen.current!.has(keyOf(p)));
    if (!added.length) return;
    added.forEach((p) => seen.current!.add(keyOf(p)));
    setFresh((f) => new Set([...f, ...added.map(keyOf)]));
    ([0, 1] as const).forEach((side) => {
      const td = added.filter((p) => p.td && plays[side].includes(p)).pop();
      if (td) setParty((pp) => (side ? [pp[0], td] : [td, pp[1]]));
    });
  }, [plays, feedList.length]);
  useEffect(() => {
    if (!party[0] && !party[1]) return;
    const t = setTimeout(() => setParty([null, null]), CELEBRATE_MS);
    return () => clearTimeout(t);
  }, [party]);

  if (!starters[0].length && !starters[1].length) return null;
  const shown = ([0, 1] as const).map((side) => {
    const keys = new Set(drives[side].map((d) => d.key));
    return plays[side].filter((p) => p.kind !== 'passinc' && (mode === 'live' ? keys.has(p.driveId) : true));
  });
  const who = (side: 0 | 1, pid: string) => starters[side].find((s) => s.id === pid)!;

  return (
    <section className="card p-4 sm:p-5" aria-label="The field">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-label">On the field</h2>
        <div className="inline-flex rounded-full border border-line bg-surface p-0.5" role="group" aria-label="What the fields show">
          {(['week', 'live'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setPicked(m)}
              className="rounded-full px-3 py-1 text-xs font-semibold text-muted aria-pressed:bg-gold aria-pressed:text-[#11161e]">
              {m === 'week' ? 'Whole week' : 'Live drives'}
            </button>
          ))}
        </div>
      </div>
      {!feedList.length && <p className="mb-3 text-sm text-muted">{relevant.length ? 'Loading plays…' : 'Plays show up here once these players’ games kick off.'}</p>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
          {([0, 1] as const).map((side) => (
            <FieldSide key={side} name={names[side]} color={COLOR[side]} plays={shown[side]} starters={starters[side]} live={mode === 'live'}
              drives={drives[side]} fresh={fresh} focus={focus[side]} onFocus={(id) => setFocus((f) => (side ? [f[0], id] : [id, f[1]]))}
              celebration={party[side] ? { play: party[side]!, who: who(side, party[side]!.pid) } : null} />
          ))}
        </div>
        {mode === 'live'
          ? <LiveFeed feeds={feedList} plays={plays} starters={starters} />
          : <BigPlays plays={plays} starters={starters} />}
      </div>
    </section>
  );
}

/** every play of the games these players are in, newest first; theirs marked with their face and points */
function LiveFeed({ feeds, plays, starters }: { feeds: { eventId: string; home: string; away: string; plays: EspnPlay[] }[]; plays: FieldPlay[][]; starters: FieldStarter[][] }) {
  const mine = new Map<string, { side: 0 | 1; p: FieldPlay }[]>();
  ([0, 1] as const).forEach((side) => plays[side].forEach((p) => mine.set(p.id, [...(mine.get(p.id) ?? []), { side, p }])));
  const rows = feeds.flatMap((f) => f.plays.filter((p) => p.time !== null && !/timeout|end of|two-minute/i.test(p.type)).map((p) => ({ p, f })))
    .sort((x, y) => y.p.time! - x.p.time!).slice(0, 40);
  return (
    <div className="min-w-0 rounded-xl border border-line">
      <h3 className="section-label border-b border-line px-3 py-2">Live plays</h3>
      <ul aria-label="Live plays" className="max-h-[560px] overflow-y-auto">
        {rows.map(({ p, f }) => {
          const ours = mine.get(p.id) ?? [];
          const side = ours[0]?.side;
          return (
            <li key={`${f.eventId}-${p.id}`} data-mine={side === undefined ? undefined : SIDE[side]}
              className={`grid grid-cols-[20px_minmax(0,1fr)] gap-2 border-b border-line px-3 py-2 text-[13px] leading-snug last:border-0 ${p.scoring ? 'text-gold' : ''}`}
              style={side === undefined ? undefined : { boxShadow: `inset 3px 0 0 ${COLOR[side]}`, background: `color-mix(in srgb, ${COLOR[side]} 7%, transparent)` }}>
              <img src={logoUrl(p.offense)} alt={p.offense} className="mt-px h-5 w-5" />
              <div className="min-w-0">
                {ours.map(({ side: s, p: fp }) => {
                  const w = starters[s].find((x) => x.id === fp.pid);
                  return w && (
                    <span key={fp.pid} className="mb-0.5 flex items-center gap-1.5 font-semibold text-ink">
                      <img src={w.img} alt="" className="h-[18px] w-[18px] rounded-full bg-surface-2 object-cover object-top" />{w.short}
                      <b className="num font-medium" style={{ color: COLOR[s] }}>{sign(fp.pts)}</b>
                    </span>
                  );
                })}
                {p.text.replace(/^(\((?:No Huddle, )?(?:Shotgun|No Huddle)\) )+/, '')}
                <small className="mt-px block text-[11.5px] text-muted">{f.away} @ {f.home} · Q{p.period} {p.clock}</small>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** the week's biggest plays by points, either side */
function BigPlays({ plays, starters }: { plays: FieldPlay[][]; starters: FieldStarter[][] }) {
  const top = ([0, 1] as const).flatMap((side) => plays[side].map((p) => ({ side, p }))).sort((x, y) => y.p.pts - x.p.pts).slice(0, 6);
  if (!top.length) return null;
  return (
    <div className="min-w-0 rounded-xl border border-line">
      <h3 className="section-label border-b border-line px-3 py-2">Biggest plays</h3>
      <ul aria-label="Biggest plays">
        {top.map(({ side, p }) => {
          const w = starters[side].find((x) => x.id === p.pid)!;
          return (
            <li key={`${p.id}:${p.pid}`} className="grid grid-cols-[26px_minmax(0,1fr)_auto] items-center gap-2 border-b border-line px-3 py-2 text-[13px] last:border-0">
              <img src={w.img} alt="" className="h-[26px] w-[26px] rounded-full bg-surface-2 object-cover object-top" style={{ boxShadow: `0 0 0 1.5px ${COLOR[side]}` }} />
              <span className="truncate">{describe(p, w.short)}</span>
              <span className="num" style={{ color: COLOR[side] }}>{sign(p.pts)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
