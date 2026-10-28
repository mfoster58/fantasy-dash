import type { ReactNode } from 'react';
import { Link } from 'react-router';
import Avatar from '../Avatar';
import { CrownIcon, FinishIcon, FlameIcon } from '../Icons';
import { ManagerLink, TeamLink } from '../NameLink';
import { ordinal } from '../../lib/charts/scale';
import type { SeasonHardware, Winner } from '../../lib/history/hardware';

const record = (p: Winner) => `${p.w}–${p.l}${p.t ? `–${p.t}` : ''}`;

function Award({ kind, icon, label, p, year, value }: { kind: string; icon: ReactNode; label: string; p: Winner | null; year: number; value: string }) {
  if (!p) return null;
  return (
    <li data-testid="award" data-award={kind} className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-bg/55 px-2.5 py-1.5">
      <span className="grid w-6 shrink-0 place-items-center">{icon}</span>
      <Avatar avatar={p.avatar} name={p.team} size={28} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
        <TeamLink userId={p.userId} year={year} className="block truncate text-[13px] font-semibold">{p.team}</TeamLink>
      </div>
      <span className="num shrink-0 text-xs text-muted">{value}</span>
    </li>
  );
}

/**
 * One season of league history. A finished season is led by its champion, built like the game of the week: that season's
 * team picture on the diagonal with a gold stripe, the team name big, the final score; the rest of the hardware sits in a
 * column on the right. A season in progress gets a lighter banner with its top seed and points leader so far.
 */
export default function SeasonBanner({ h }: { h: SeasonHardware }) {
  const pts = (p: Winner | null) => (p?.pf == null ? '' : `${Math.round(p.pf).toLocaleString('en-US')} pts`);
  const review = <Link to={`/history/${h.year}`} className="text-xs font-semibold text-accent hover:underline">Season review →</Link>;

  if (h.live || !h.champion) {
    return (
      <section aria-label={`${h.year} season`} className="card blue-wash grid gap-4 border-dashed p-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center">
        <div>
          <div className="font-display text-xs font-bold uppercase tracking-[0.2em] text-accent">{h.year} · In progress · through week {h.lastScoredWeek}</div>
          <h2 className="mt-1.5 font-display text-[34px] font-bold uppercase leading-none">The {h.year} season</h2>
          <p className="mt-2 text-sm text-ink/85">The hardware is handed out after the final. {review}</p>
        </div>
        <ul className="grid gap-1.5">
          <Award kind="seed" icon={<CrownIcon className="text-accent" width="1.3em" height="1.3em" />} label="Top seed so far" p={h.seed} year={h.year} value={h.seed ? record(h.seed) : ''} />
          <Award kind="pointsTitle" icon={<FlameIcon title="Points leader" />} label="Points leader so far" p={h.pointsTitle} year={h.year} value={pts(h.pointsTitle)} />
        </ul>
      </section>
    );
  }

  const c = h.champion;
  return (
    <section aria-label={`${h.year} season`} className="card relative isolate flex flex-col overflow-hidden border-gold/30 bg-[radial-gradient(60%_140%_at_0%_0%,color-mix(in_srgb,var(--gold)_26%,transparent),transparent_65%),linear-gradient(160deg,color-mix(in_srgb,var(--gold)_10%,var(--surface))_0%,var(--surface)_100%)] sm:flex-row">
      <div aria-hidden="true" className="relative h-44 w-full shrink-0 sm:h-auto sm:min-h-[240px] sm:w-[300px] lg:w-[340px]">
        {/* the picture's edge is skewed by the stripes' 11deg; the picture runs well past it so no edge shows at the corners */}
        <div className="absolute inset-y-0 -left-12 right-[46px] -skew-x-[11deg] overflow-hidden bg-surface-2">
          {c.avatar
            ? <div data-testid="champion-photo" className="absolute inset-y-0 -left-5 -right-24 skew-x-[11deg] bg-cover bg-[center_30%]" style={{ backgroundImage: `url(${c.avatar})` }} />
            : <div data-testid="champion-photo" className="flex h-full skew-x-[11deg] items-center pl-16 font-display text-6xl font-bold text-muted">{c.team.slice(0, 2).toUpperCase()}</div>}
        </div>
        <div className="absolute -inset-y-3 right-[38px] w-2 -skew-x-[11deg] bg-gold" />
        <div className="absolute -inset-y-3 right-[26px] w-[5px] -skew-x-[11deg] bg-accent" />
      </div>
      <div className="relative grid min-w-0 flex-1 items-center gap-5 p-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <span aria-hidden="true" className="pointer-events-none absolute right-5 top-3 font-display text-[64px] font-bold leading-none text-ink/10 lg:right-[24.5rem]">{h.year}</span>
        <div className="min-w-0">
          <div className="font-display text-xs font-bold uppercase tracking-[0.2em] text-gold">{h.year} Champion</div>
          <h2 className="mt-1.5 font-display text-[34px] font-bold uppercase leading-[0.95] tracking-wide sm:text-[44px]">
            <TeamLink userId={c.userId} year={h.year}>{c.team}</TeamLink>
          </h2>
          <p className="mt-1.5 text-sm text-ink/85">
            <ManagerLink userId={c.userId} className="font-medium">{c.manager}</ManagerLink> · {record(c)}{c.rank ? ` · ${ordinal(c.rank)} in the regular season` : ''}
          </p>
          {h.final && h.runnerUp && (
            <div data-testid="final" className="mt-3 inline-flex flex-wrap items-baseline gap-2 rounded-lg border border-white/5 bg-bg/50 px-3 py-2 text-[13px] text-muted">
              <span>Final</span><b className="font-display text-[22px] leading-none text-ink">{h.final.winner.toFixed(2)}</b><span>–</span><b className="font-display text-[22px] leading-none">{h.final.loser.toFixed(2)}</b><span>over {h.runnerUp.team}</span>
            </div>
          )}
          <div className="mt-3">{review}</div>
        </div>
        <ul className="grid gap-1.5">
          <Award kind="runnerUp" icon={<FinishIcon kind="runnerUp" />} label="Runner-up" p={h.runnerUp} year={h.year} value={h.runnerUp ? record(h.runnerUp) : ''} />
          <Award kind="third" icon={<FinishIcon kind="third" />} label="Third place" p={h.third} year={h.year} value={h.third ? record(h.third) : ''} />
          <Award kind="pointsTitle" icon={<FlameIcon />} label="Points title" p={h.pointsTitle} year={h.year} value={pts(h.pointsTitle)} />
          <Award kind="seed" icon={<CrownIcon className="text-accent" width="1.3em" height="1.3em" />} label="No. 1 seed" p={h.seed} year={h.year} value={h.seed ? record(h.seed) : ''} />
          <Award kind="lastPlace" icon={<FinishIcon kind="toilet" />} label="Last place" p={h.lastPlace} year={h.year} value={h.lastPlace ? record(h.lastPlace) : ''} />
        </ul>
      </div>
    </section>
  );
}
