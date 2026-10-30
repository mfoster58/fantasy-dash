import { useId } from 'react';
import type { LiveDrive } from '../../../lib/field/drives';
import { FIELD_H, FIELD_W, isBig, markOf, Y } from '../../../lib/field/geometry';
import type { FieldPlay } from '../../../lib/field/readPlays';
import { logoUrl } from '../../stats/players/TeamLogo';

export interface FieldStarter { id: string; name: string; short: string; pos: string; img: string; points: number }

const sign = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1)}`;

/** One lineup's offense going up its own field: every play drawn where it happened, and the drives on now. */
export default function FieldSide({ name, total, head = true, color, plays, starters, live, drives, fresh, focus, onFocus, celebration }: {
  name: string;
  /** the team's points */
  total: number;
  /** the name and total over the field; a phone's team switch carries them instead */
  head?: boolean;
  /** the side's colour: the field's end zone, the drive lines */
  color: string;
  plays: FieldPlay[];
  starters: FieldStarter[];
  /** the live drives view: every play gets its face and points */
  live: boolean;
  drives: LiveDrive[];
  /** plays that arrived since the first look, to draw in */
  fresh: Set<string>;
  focus: string | null;
  onFocus: (id: string | null) => void;
  celebration: { play: FieldPlay; who: FieldStarter } | null;
}) {
  const uid = useId().replace(/:/g, '');
  const byId = new Map(starters.map((s) => [s.id, s]));
  const marks = plays.map((p) => ({ p, m: markOf(p), who: byId.get(p.pid) }));
  return (
    <div className="min-w-0 space-y-2">
      {/* the name and total sit over the field's own edges, not the column's */}
      {head && <div className="mx-auto flex w-full max-w-[306px] items-baseline justify-between gap-2" style={{ color }}>
        <h3 className="truncate font-display text-lg font-bold uppercase leading-none">{name}</h3>
        <span data-testid="mf-total" className="font-display text-xl font-bold leading-none tabular-nums">{total.toFixed(2)}</span>
      </div>}
      <div className="relative mx-auto w-full max-w-[306px]">
        <svg viewBox={`0 -4 ${FIELD_W} ${FIELD_H + 4}`} role="img" aria-label={`${name}'s plays on the field`} className="block w-full rounded-lg">
          <defs>
            <filter id={`glow${uid}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            <clipPath id={`head${uid}`} clipPathUnits="objectBoundingBox"><circle cx=".5" cy=".5" r=".5" /></clipPath>
            <marker id={`x${uid}`} viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5"><path d="M2 2 8 8M8 2 2 8" style={{ stroke: 'var(--muted)' }} strokeWidth={2} /></marker>
          </defs>
          <Turf color={color} />
          {drives.map((d, k) => <Drive key={d.key} d={d} x={drives.length === 1 ? 80 : 44 + (k * 72) / (drives.length - 1)} color={color} />)}
          {live && !drives.length && (
            <text x={80} y={176} textAnchor="middle" fontSize={11} fontWeight={700} letterSpacing=".08em" className="font-display" style={{ fill: 'var(--muted)' }}>NO DRIVES ON</text>
          )}
          {marks.map(({ p, m, who }) => {
            const big = isBig(p);
            const col = `var(--pos-${who?.pos ?? 'WR'})`;
            const w = big ? 2.8 : 1.3, op = big ? 1 : 0.6;
            const glow = big ? `url(#glow${uid})` : undefined;
            const dim = focus !== null && focus !== p.pid;
            const qb = p.kind === 'pass';
            return (
              <g key={`${p.id}:${p.pid}`} data-testid="mf-play" data-pid={p.pid} data-kind={p.kind} data-drive={p.driveId} data-end={m.end && (big || live) ? '1' : '0'}
                className={`transition-opacity ${dim ? 'opacity-10' : ''} ${fresh.has(`${p.id}:${p.pid}`) ? 'mf-new' : ''}`}>
                {m.flight && (
                  <path d={m.flight} className="mf-fade" fill="none" strokeWidth={p.kind === 'int' ? 1.6 : 1} strokeDasharray="2 2.5"
                    // a target that fell incomplete is gray: only a catch carries the player's colour
                    opacity={p.kind === 'inc' ? 0.55 : 0.8} style={{ stroke: p.kind === 'int' ? 'var(--loss)' : p.kind === 'inc' ? 'var(--muted)' : col }}
                    markerEnd={p.kind === 'inc' ? `url(#x${uid})` : undefined} />
                )}
                {m.path && (
                  <path d={m.path} className="mf-draw" pathLength={1} fill="none" strokeLinecap="round" filter={glow}
                    strokeWidth={qb && !big ? (live ? 2 : 1) : w} opacity={qb && !big ? (live ? 0.95 : 0.4) : op} style={{ stroke: col }} />
                )}
                {p.kind === 'int' && m.miss && (
                  <path d={`M${m.miss[0] - 4} ${m.miss[1] - 4}l8 8m0-8l-8 8`} className="mf-late" strokeWidth={2.2} style={{ stroke: 'var(--loss)' }} />
                )}
                {p.td && m.end && <Burst at={m.end} />}
                {m.end && who && (big || live) && <Tag at={m.end} play={p} who={who} col={col} big={big} clip={`head${uid}`} />}
              </g>
            );
          })}
        </svg>
        {celebration && <Celebration {...celebration} color={color} />}
      </div>
      <ul className="mx-auto grid max-w-[306px] gap-1" aria-label={`${name}'s players`}>
        {starters.map((s) => (
          <li key={s.id}>
            <button type="button" aria-pressed={focus === s.id} onClick={() => onFocus(focus === s.id ? null : s.id)}
              className="grid w-full grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-1.5 rounded-md border border-line bg-surface px-1.5 py-1 text-left text-xs sm:text-[13px] aria-pressed:border-[var(--c)] aria-pressed:bg-surface-2"
              style={{ ['--c' as string]: `var(--pos-${s.pos})` }}>
              <img src={s.img} alt="" className="h-[22px] w-[22px] rounded-full bg-surface-2 object-cover object-top" />
              <span className="truncate"><i aria-hidden="true" className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: `var(--pos-${s.pos})` }} />{s.short}</span>
              <span className="num text-muted">{s.points.toFixed(1)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Turf({ color }: { color: string }) {
  const lines = [];
  for (let yd = 5; yd < 100; yd += 5) {
    lines.push(<line key={yd} x1={0} x2={FIELD_W} y1={Y(yd)} y2={Y(yd)} strokeWidth={yd % 10 ? 0.5 : 1} style={{ stroke: 'var(--field-line)' }} />);
    if (yd % 10 === 0) for (const x of [10, 150]) {
      lines.push(<text key={`${yd}${x}`} x={x} y={Y(yd) + 3} textAnchor="middle" fontSize={7} className="num" transform={`rotate(${x < 80 ? -90 : 90} ${x} ${Y(yd)})`} style={{ fill: 'var(--muted)' }}>{yd <= 50 ? yd : 100 - yd}</text>);
    }
  }
  return (
    <g aria-hidden="true">
      <rect x={0} y={0} width={FIELD_W} height={FIELD_H} style={{ fill: 'var(--field)' }} />
      {[0, 2, 4, 6, 8].map((i) => <rect key={i} x={0} y={Y(i * 10)} width={FIELD_W} height={30} style={{ fill: 'var(--field-band)' }} opacity={0.5} />)}
      <rect x={0} y={0} width={FIELD_W} height={30} style={{ fill: `color-mix(in srgb, ${color} 20%, var(--field))` }} />
      <rect x={0} y={330} width={FIELD_W} height={30} style={{ fill: 'color-mix(in srgb, var(--muted) 10%, var(--field))' }} />
      <text x={80} y={19} textAnchor="middle" fontSize={12} fontWeight={700} letterSpacing=".2em" className="font-display" style={{ fill: color }}>END ZONE</text>
      {lines}
      {[0, 100].map((yd) => <line key={yd} x1={0} x2={FIELD_W} y1={Y(yd)} y2={Y(yd)} strokeWidth={1.5} style={{ stroke: 'var(--muted)' }} />)}
    </g>
  );
}

/** a drive on now: a dashed line from where it began, the team's logo where the ball is, and the down beside it */
function Drive({ d, x, color }: { d: LiveDrive; x: number; color: string }) {
  const spot = d.spot ?? d.from ?? 50;
  // a score in gold; a drive that ended any other way in gray
  const tone = d.result ? (/touchdown|field goal/i.test(d.result) ? 'var(--gold)' : 'var(--muted)') : 'var(--ink)';
  const label = d.result ? d.result.toUpperCase() : (d.down ?? '').split(' at ')[0];
  const lw = label.length * 4.3 + 8, right = x < 110, lx = right ? x - 12 - lw : x + 12;
  return (
    <g data-testid="mf-drive" data-team={d.team} aria-label={`${d.team} ball${d.down ? `, ${d.down}` : ''}`}>
      {spot <= 20 && <rect x={0} y={Y(0)} width={FIELD_W} height={60} style={{ fill: 'color-mix(in srgb, var(--loss) 12%, transparent)' }} />}
      {d.from !== null && <line x1={x} x2={x} y1={Y(d.from)} y2={Y(spot)} strokeWidth={1.6} strokeDasharray="3 3" opacity={0.55} style={{ stroke: 'var(--ink)' }} />}
      {d.from !== null && <line x1={x - 5} x2={x + 5} y1={Y(d.from)} y2={Y(d.from)} strokeWidth={1.6} opacity={0.55} style={{ stroke: 'var(--ink)' }} />}
      <line x1={0} x2={FIELD_W} y1={Y(spot)} y2={Y(spot)} strokeWidth={1} opacity={0.7} style={{ stroke: color }} />
      <circle cx={x} cy={Y(spot)} r={9} strokeWidth={1.4} style={{ fill: 'var(--surface)', stroke: tone }} />
      <image href={logoUrl(d.team)} x={x - 7.5} y={Y(spot) - 7.5} width={15} height={15} />
      {label && (
        <g>
          <rect x={lx} y={Y(spot) - 5} width={lw} height={10} rx={2} style={{ fill: tone }} />
          <text x={lx + lw / 2} y={Y(spot) + 2.5} textAnchor="middle" fontSize={7.5} fontWeight={700} className="font-display" style={{ fill: 'var(--bg)' }}>{label}</text>
        </g>
      )}
    </g>
  );
}

function Burst({ at }: { at: [number, number] }) {
  return (
    <g className="mf-late" aria-hidden="true">
      {Array.from({ length: 10 }, (_, k) => {
        const a = (k / 10) * Math.PI * 2;
        return <line key={k} x1={at[0] + Math.cos(a) * 6} y1={at[1] + Math.sin(a) * 6} x2={at[0] + Math.cos(a) * 11} y2={at[1] + Math.sin(a) * 11} strokeWidth={1.4} strokeLinecap="round" style={{ stroke: 'var(--gold)' }} />;
      })}
    </g>
  );
}

/** the player's face where the play ended and its points beside it */
function Tag({ at: [x, y], play, who, col, big, clip }: { at: [number, number]; play: FieldPlay; who: FieldStarter; col: string; big: boolean; clip: string }) {
  const r = big ? 9.5 : 7, label = sign(play.pts), fs = big ? 7 : 6;
  const lw = label.length * (big ? 4.6 : 4) + 6, lx = Math.min(FIELD_W - 4 - lw, Math.max(4, x + r + 1.5));
  const tone = play.pts < 0 ? 'var(--loss)' : col;
  return (
    <g data-testid="mf-tag" className="mf-late">
      <circle cx={x} cy={y} r={r} strokeWidth={big ? 1.6 : 1.2} style={{ fill: 'var(--surface-2)', stroke: tone }} />
      <image href={who.img} x={x - r + 0.5} y={y - r + 0.5} width={r * 2 - 1} height={r * 2 - 1} preserveAspectRatio="xMidYMin slice" clipPath={`url(#${clip})`} />
      <rect x={lx} y={y - fs / 2 - 1.5} width={lw} height={fs + 3} rx={2} style={{ fill: tone }} />
      <text x={lx + lw / 2} y={y + fs / 2 - 0.6} textAnchor="middle" fontSize={fs} fontWeight={500} className="num" style={{ fill: '#11161e' }}>{label}</text>
    </g>
  );
}

/** a touchdown: the end zone flashes, the scorer's face and the word slam in, confetti, the points rise toward the score */
function Celebration({ play, who, color }: { play: FieldPlay; who: FieldStarter; color: string }) {
  let seed = 0;
  for (const c of play.id) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed % 1000) / 1000; };
  const bits = Array.from({ length: 40 }, (_, k) => {
    const a = Math.PI * (1.05 + rand() * 0.9), d = 70 + rand() * 120;
    return { k, dx: Math.cos(a) * d, dy: Math.sin(a) * d * 1.3 + 160, r: rand() * 720 - 360, delay: rand() * 0.25, gold: k % 3 !== 0, w: 4 + rand() * 4, h: 6 + rand() * 6 };
  });
  return (
    <div data-testid="mf-celebration" role="status" className="mf-td pointer-events-none absolute inset-0 overflow-hidden rounded-lg" style={{ ['--c' as string]: color }}>
      <div className="mf-td-flash" />
      <div className="mf-td-conf absolute left-1/2 top-[8%]" aria-hidden="true">
        {bits.map((b) => (
          <i key={b.k} style={{ ['--dx' as string]: `${b.dx}px`, ['--dy' as string]: `${b.dy}px`, ['--r' as string]: `${b.r}deg`, ['--d' as string]: `${b.delay}s`, width: b.w, height: b.h, background: b.gold ? 'var(--gold)' : color }} />
        ))}
      </div>
      <div className="mf-td-card flex flex-col items-center gap-0.5 text-center">
        <img src={who.img} alt="" className="aspect-square w-[34%] max-w-24 rounded-full bg-surface-2 object-cover object-top" style={{ boxShadow: `0 0 0 3px ${color}, 0 0 28px ${color}` }} />
        <div className="mf-td-word mt-1.5 font-display text-[clamp(24px,7vw,40px)] font-bold uppercase italic leading-[.95] text-gold [text-shadow:0_2px_0_#11161e]">Touchdown</div>
        <div className="text-[13px] font-semibold text-ink [text-shadow:0_1px_6px_#11161e]">{who.name}</div>
        <div className="mf-td-pts font-display text-[26px] font-bold" style={{ color }}>{sign(play.pts)}</div>
      </div>
    </div>
  );
}
