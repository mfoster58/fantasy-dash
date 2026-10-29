import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameSide, PlayerDirectory, PlayerId } from '@fantasy-dash/core';
import { liveDrives } from '../../../lib/field/drives';
import { busiestMoments, feedAt, replaySpan } from '../../../lib/field/replay';
import type { EspnPlay } from '../../../lib/field/espnGame';
import { readPlays, type FieldPlay, type Starter } from '../../../lib/field/readPlays';
import { useGameFeeds } from '../../../lib/field/useGameFeeds';
import type { NflGame } from '../../../lib/live/espn';
import { headshotUrl, playerTeam } from '../../../lib/players';
import { useIsPhone } from '../../../lib/useIsPhone';
import { logoUrl } from '../../stats/players/TeamLogo';
import FieldSide, { type FieldStarter } from './FieldSide';

const COLOR = ['var(--accent)', 'var(--coral)'] as const;
const SIDE = ['a', 'b'] as const;
/** how long a touchdown celebration plays */
const CELEBRATE_MS = 3000;
const REPLAY_TICK_MS = 250;
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
export default function MatchupField({ sides, names, players, scoring, games, seasonTeams, fetcher, replay = false }: {
  sides: [GameSide, GameSide];
  names: [string, string];
  players: PlayerDirectory;
  scoring: Record<string, number>;
  /** this week's NFL games from ESPN's scoreboard */
  games: NflGame[] | null;
  seasonTeams?: Record<PlayerId, string>;
  fetcher?: (url: string) => Promise<Response>;
  /** open already replaying (the box score's ?replay) */
  replay?: boolean;
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
  const loaded = useMemo(() => relevant.flatMap((g) => (feeds[g.id!] ? [feeds[g.id!]] : [])), [relevant, feeds]);

  // replay: once the games are over, a clock can run back through them, each shown as it stood then
  const canReplay = !!loaded.length && !relevant.some((g) => g.state === 'in') && loaded.every((f) => f.state === 'post');
  const [replaying, setReplaying] = useState(replay);
  const on = replaying && canReplay;
  const span = useMemo(() => (on ? replaySpan(loaded) : null), [on, loaded]);
  const moments = useMemo(() => (on ? busiestMoments(loaded, teams) : []), [on, loaded, teams]);
  const [clock, setClock] = useState<number | null>(null);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(30);
  const at = span ? Math.min(Math.max(clock ?? span[0], span[0]), span[1]) : null;
  useEffect(() => {
    if (!span || !running) return;
    const t = setInterval(() => setClock((c) => Math.min((c ?? span[0]) + REPLAY_TICK_MS * speed, span[1])), REPLAY_TICK_MS);
    return () => clearInterval(t);
  }, [span, running, speed]);
  const feedList = useMemo(() => (at === null ? loaded : loaded.flatMap((f) => feedAt(f, at) ?? [])), [loaded, at]);
  const plays = useMemo(() => starters.map((list) => feedList.flatMap((f) => readPlays(f, list, scoring)).sort((x, y) => (x.time ?? 0) - (y.time ?? 0))), [feedList, starters, scoring]);

  const anyLive = on ? feedList.some((f) => f.state === 'in') : relevant.some((g) => g.state === 'in');
  const [picked, setPicked] = useState<'live' | 'week' | null>(null);
  const mode = picked ?? (anyLive ? 'live' : 'week');
  const [focus, setFocus] = useState<[string | null, string | null]>([null, null]);
  const phone = useIsPhone();
  const [view, setView] = useState<0 | 1>(0);

  // a drive that scored stays up a few seconds: look again every few seconds while games are on
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!anyLive) return;
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, [anyLive]);
  const drives = useMemo(() => (mode === 'live' ? teams.map((t) => liveDrives(feedList, t, at ?? now)) : [[], []]), [mode, teams, feedList, now, at]);

  // plays already there at the first look are drawn as they are; anything after draws itself in, and a touchdown is celebrated
  // a replay starts before kickoff, so everything in it arrives
  const seen = useRef<Set<string> | null>(replay ? new Set() : null);
  // a jump or a drag of the clock takes in what it passes without drawing it in or celebrating
  const quiet = useRef(false);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [party, setParty] = useState<[FieldPlay | null, FieldPlay | null]>([null, null]);
  useEffect(() => {
    if (!feedList.length) return;
    const all = plays.flat();
    if (!seen.current) { seen.current = new Set(all.map(keyOf)); return; }
    const added = all.filter((p) => !seen.current!.has(keyOf(p)));
    added.forEach((p) => seen.current!.add(keyOf(p)));
    if (quiet.current) { quiet.current = false; return; }
    if (!added.length) return;
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

  const startReplay = () => {
    seen.current = new Set(); quiet.current = false;
    setFresh(new Set()); setParty([null, null]); setClock(null); setRunning(true); setPicked(null); setReplaying(true);
  };
  const stopReplay = () => {
    seen.current = null;
    setFresh(new Set()); setParty([null, null]); setClock(null); setPicked(null); setReplaying(false);
  };
  const jump = (t: number) => { quiet.current = true; setClock(t); };

  if (!starters[0].length && !starters[1].length) return null;
  const shown = ([0, 1] as const).map((side) => {
    const keys = new Set(drives[side].map((d) => d.key));
    return plays[side].filter((p) => p.kind !== 'passinc' && (mode === 'live' ? keys.has(p.driveId) : true));
  });
  const who = (side: 0 | 1, pid: string) => starters[side].find((s) => s.id === pid)!;
  // a replay counts up from its plays; otherwise each team's real score
  const totals = ([0, 1] as const).map((side) => (on ? plays[side].reduce((n, p) => n + p.pts, 0) : sides[side].points));

  return (
    <section className="card p-4 sm:p-5" aria-label="The field">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="section-label">On the field</h2>
        <div className="flex flex-wrap items-center gap-2">
        {canReplay && !on && (
          <button type="button" onClick={startReplay} className="rounded-full border border-gold px-3 py-1 text-xs font-semibold text-gold"><span aria-hidden="true">▶ </span>Replay the week</button>
        )}
        <div className="inline-flex rounded-full border border-line bg-surface p-0.5" role="group" aria-label="What the fields show">
          {(['week', 'live'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setPicked(m)}
              className="rounded-full px-3 py-1 text-xs font-semibold text-muted aria-pressed:bg-gold aria-pressed:text-[#11161e]">
              {m === 'week' ? 'Whole week' : 'Live drives'}
            </button>
          ))}
        </div>
        </div>
      </div>
      {on && span && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-gold/40 px-3 py-2 text-xs">
          <span className="font-display text-sm font-bold uppercase tracking-wide text-gold">Replay</span>
          <button type="button" onClick={() => setRunning((r) => !r)} aria-label={running ? 'Pause replay' : 'Play replay'}
            className="grid h-8 w-8 place-items-center rounded-full bg-gold text-[#11161e]">{running ? '❚❚' : '▶'}</button>
          <input type="range" aria-label="Replay clock" min={span[0]} max={span[1]} step={1000} value={at ?? span[0]}
            onChange={(e) => jump(Number(e.target.value))} className="min-w-32 flex-1 accent-[var(--gold)]" />
          <span className="num text-muted">{new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(at ?? span[0])} ET</span>
          <select aria-label="Replay speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="rounded border border-line bg-surface px-1 py-0.5">
            {[10, 30, 120].map((x) => <option key={x} value={x}>{x}×</option>)}
          </select>
          <button type="button" onClick={stopReplay} className="rounded-full border border-line px-3 py-1 font-semibold text-ink">Done</button>
          {moments.length > 0 && (
            <div role="group" aria-label="Jump to" className="flex w-full flex-wrap items-center gap-1.5">
              <span className="text-muted">Jump to</span>
              {moments.map((t) => (
                <button key={t} type="button" onClick={() => jump(t)} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 font-semibold text-muted hover:text-ink">
                  {new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(t)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {!feedList.length && !on && <p className="mb-3 text-sm text-muted">{relevant.length ? 'Loading plays…' : 'Plays show up here once these players’ games kick off.'}</p>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        {/* a phone shows one field at a time, picked by team; the switch carries both scores */}
        {phone && (
          <div role="group" aria-label="Whose field" className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1">
            {([0, 1] as const).map((side) => (
              <button key={side} type="button" aria-pressed={view === side} onClick={() => setView(side)}
                className="flex min-w-0 items-baseline justify-between gap-2 rounded-lg px-2.5 py-2 text-left"
                style={{ color: COLOR[side], background: view === side ? `color-mix(in srgb, ${COLOR[side]} 16%, transparent)` : undefined }}>
                <span className="truncate font-display text-[15px] font-bold uppercase leading-none">{names[side]}</span>
                <span className="font-display text-base font-bold leading-none tabular-nums">{totals[side].toFixed(2)}</span>
              </button>
            ))}
          </div>
        )}
        <div className={phone ? '' : 'grid grid-cols-2 gap-2.5 sm:gap-4'}>
          {([0, 1] as const).filter((side) => !phone || side === view).map((side) => (
            <FieldSide key={side} name={names[side]} color={COLOR[side]} head={!phone}
              total={totals[side]} plays={shown[side]} starters={starters[side]} live={mode === 'live'}
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
