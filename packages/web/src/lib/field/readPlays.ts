/**
 * Turns ESPN's play-by-play text into the plays a lineup's starters made: who, what kind, from where, how far, which
 * side of the field and how many points under the league's scoring. ESPN names players "K.Concepcion" or
 * "Bi.Robinson", so a starter is found by the first letter of their first name and their surname, within their team's
 * possessions.
 */
import { scoreStats, type PlayerId } from '@fantasy-dash/core';
import type { EspnGameFeed, EspnPlay } from './espnGame';

export interface Starter { id: PlayerId; firstName: string; lastName: string; team: string; pos: string }

/** a catch, a target that fell incomplete, a run, a quarterback's completion, incompletion or interception */
export type PlayKind = 'rec' | 'inc' | 'run' | 'pass' | 'passinc' | 'int';
export type Side = 'left' | 'middle' | 'right';

export interface FieldPlay {
  /** ESPN's play id */
  id: string;
  eventId: string;
  driveId: string;
  pid: PlayerId;
  kind: PlayKind;
  /** yards to the end zone at the snap */
  los: number;
  gain: number;
  td: boolean;
  /** a pass's side and depth; a run's gap */
  dir: Side;
  depth: 'short' | 'deep';
  gap: string | null;
  pts: number;
  time: number | null;
  period: number;
  clock: string;
  text: string;
}

/** how ESPN's play text writes a team when it differs from the team code */
const TEXT_CODE: Record<string, string> = { HOU: 'HST', CLE: 'CLV', BAL: 'BLT', ARI: 'ARZ', LAR: 'LA', WAS: 'WSH' };
const ours = (code: string, team: string) => code === team || code === TEXT_CODE[team];
const GAPS = ['left end', 'left tackle', 'left guard', 'up the middle', 'right guard', 'right tackle', 'right end', 'scrambles', 'kneels'];
const SUFFIX = / (Jr\.|Sr\.|II|III|IV|V)$/;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** the fumble went to the other team */
function lost(text: string, team: string): boolean {
  const m = /RECOVERED by ([A-Z]+)/i.exec(text);
  return /FUMBLES/.test(text) && !!m && !ours(m[1], team);
}

/** the first "for N yards" (or "for no gain") at or after where the player is named */
function gainFrom(text: string, from: number): number | null {
  const rest = text.slice(from);
  const m = /for (-?\d+) yards?/.exec(rest);
  if (m) return Number(m[1]);
  return /for no gain/.test(rest) ? 0 : null;
}

/**
 * A foul by the offense during the play (holding downfield) is marked off from where it happened: the player keeps
 * only the yards up to that spot. "enforced at CLV 44" is 44 yards from Cleveland's own goal; "enforced at 50" is midfield.
 */
function creditedGain(text: string, team: string, los: number, gain: number): number {
  const m = /PENALTY on ([A-Z]+)\b[^]*?enforced at (?:([A-Z]+) )?(\d+)/.exec(text);
  if (!m || !ours(m[1], team)) return gain;
  const yard = Number(m[3]);
  const spot = !m[2] ? 50 : ours(m[2], team) ? 100 - yard : yard;
  return Math.min(gain, los - spot);
}

const sideOf =(text: string): { dir: Side; depth: 'short' | 'deep' } => {
  const m = /pass (?:incomplete )?(short|deep)? ?(left|middle|right)?/.exec(text);
  return { dir: (m?.[2] as Side | undefined) ?? 'middle', depth: m?.[1] === 'deep' ? 'deep' : 'short' };
};

function readOne(p: EspnPlay, s: Starter, scoring: Record<string, number>): Omit<FieldPlay, 'id' | 'eventId' | 'driveId' | 'pid' | 'time' | 'period' | 'clock' | 'text'> | null {
  const t = p.text;
  if (p.offense !== s.team || p.start === null || /no play/i.test(t) || /timeout|end of|two-minute/i.test(p.type)) return null;
  const name = `${esc(s.firstName[0] ?? '')}[a-z]{0,2}\\.${esc(s.lastName.replace(SUFFIX, ''))}(?![A-Za-z])`;
  const td = /TOUCHDOWN/i.test(t) && !/NULLIFIED/i.test(t) && !lost(t, s.team) && !/INTERCEPTED/.test(t);
  const fum = lost(t, s.team) ? 1 : 0;
  const pts = (stats: Record<string, number>) => scoreStats({ ...stats, ...(fum ? { fum_lost: 1 } : {}) }, scoring);
  const base = { los: p.start, td, gap: null, ...sideOf(t) };

  // a quarterback's own throw
  const thrower = new RegExp(`(?:^|\\) |\\.\\s+)${name} pass`).exec(t);
  if (s.pos === 'QB' && thrower) {
    if (/INTERCEPTED/.test(t)) return { ...base, kind: 'int', gain: 0, td: false, pts: pts({ pass_att: 1, pass_int: 1 }) };
    if (/pass incomplete/.test(t)) return { ...base, kind: 'passinc', gain: 0, td: false, pts: pts({ pass_att: 1, pass_inc: 1 }) };
    const g = gainFrom(t, thrower.index);
    if (g === null) return null;
    return { ...base, kind: 'pass', gain: g, pts: pts({ pass_att: 1, pass_cmp: 1, pass_yd: g, pass_td: td ? 1 : 0 }) };
  }
  // thrown to them
  const target = new RegExp(`pass (?:incomplete )?(?:(?:short|deep) )?(?:(?:left|middle|right) )?(?:intended )?(?:for |to )(${name})`).exec(t);
  if (target) {
    if (/INTERCEPTED/.test(t)) return null;
    if (/pass incomplete/.test(t)) return { ...base, kind: 'inc', gain: 0, td: false, pts: 0 };
    const said = gainFrom(t, target.index + target[0].length - target[1].length);
    if (said === null) return null;
    const g = creditedGain(t, s.team, p.start, said);
    return { ...base, kind: 'rec', gain: g, pts: pts({ rec: 1, rec_yd: g, rec_td: td ? 1 : 0 }) };
  }
  // their own run; not one where they pick up someone else's fumble and run with it
  const run = new RegExp(`(?:^|\\) |\\.\\s+)(${name}) (${GAPS.join('|')}|to |for |pushed )`).exec(t);
  if (run && !/recovered by/i.test(t.slice(0, run.index))) {
    const at = run.index + run[0].length - run[2].length - 1;
    if (/^ ?pass/.test(t.slice(at, at + 6))) return null;
    const said = gainFrom(t, at);
    if (said === null) return null;
    const g = creditedGain(t, s.team, p.start, said);
    return { ...base, kind: 'run', gain: g, gap: GAPS.includes(run[2]) ? run[2] : 'up the middle', pts: pts({ rush_att: 1, rush_yd: g, rush_td: td ? 1 : 0 }) };
  }
  return null;
}

/** Every play the given starters made in one game; kickers and defences are left out. */
export function readPlays(feed: EspnGameFeed, starters: Starter[], scoring: Record<string, number>): FieldPlay[] {
  const who = starters.filter((s) => s.pos !== 'K' && s.pos !== 'DEF' && (s.team === feed.home || s.team === feed.away));
  const out: FieldPlay[] = [];
  for (const p of feed.plays) {
    for (const s of who) {
      const r = readOne(p, s, scoring);
      if (r) out.push({ ...r, id: p.id, eventId: feed.eventId, driveId: p.driveId, pid: s.id, time: p.time, period: p.period, clock: p.clock, text: p.text });
    }
  }
  return out;
}
