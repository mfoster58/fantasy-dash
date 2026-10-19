import type { Trends, TrendRow } from '../../../lib/stats/players/trends';
import { PlayerLink } from '../../NameLink';
import { logoUrl } from './TeamLogo';

const sign = (v: number, d = 1) => `${v > 0 ? '+' : ''}${v.toFixed(d)}`;

function Cell({ cell }: { cell: TrendRow['cells'][string] }) {
  const top = Math.max(1, ...cell.weeks.map((w) => w.value ?? 0));
  const lastHealthy = [...cell.weeks].reverse().find((w) => w.state === 'healthy' && w.value != null)?.week;
  const tone = cell.change == null ? '' : cell.change >= 0 ? 'var(--win)' : 'var(--loss)';
  return (
    <td className="border-t border-line px-1.5 py-1.5">
      <div className="flex items-end justify-center gap-1">
        <div className="flex h-9 items-end gap-1">
          {cell.weeks.map((w) => (
            <span key={w.week} data-week={w.week} data-state={w.state} title={w.state === 'short' ? `Week ${w.week}: injury-shortened (${w.value ?? '–'})` : `Week ${w.week}: ${w.value ?? w.state}`}
              className="relative block w-3.5 rounded-t-sm"
              style={w.state === 'bye' ? { height: 2, borderTop: '2px dotted var(--dim)' } : w.value == null ? { height: 2, background: 'var(--line)' }
                : { height: Math.max(2, (w.value / top) * 26), background: w.week === lastHealthy && tone ? tone : 'var(--dim)', opacity: w.state === 'short' ? 0.35 : 1 }}>
              {w.value != null && w.state !== 'bye' && <i className="absolute bottom-full left-1/2 -translate-x-1/2 text-[9px] not-italic text-muted">{w.state === 'short' ? '✚' : w.value}</i>}
            </span>
          ))}
        </div>
        {cell.change != null && <b className="num min-w-[2.6rem] pl-1 text-xs" style={{ color: tone }}>{sign(cell.change)}</b>}
      </div>
    </td>
  );
}

/** Whose role is growing and whose is shrinking: the last two healthy weeks against the earlier ones. */
export default function TrendsTable({ data, pos, season }: { data: Trends; pos: 'RB' | 'WR' | 'TE'; season: number }) {
  const max = Math.max(0.01, ...[...data.up, ...data.down].map((r) => Math.abs(r.score)));
  const id = `trends-${pos}`;
  const row = (r: TrendRow, i: number) => (
    <tr key={r.id}>
      <td className="border-t border-line px-2 text-xs text-muted">{i + 1}</td>
      <td className="border-t border-line px-2 py-1.5">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <img src={logoUrl(r.team)} alt="" className="h-6 w-6" />
          <div><PlayerLink id={r.id} className="font-semibold">{r.name}</PlayerLink><div className="text-[10.5px] text-muted">{r.team}</div></div>
        </div>
      </td>
      {data.columns.map((c) => <Cell key={c.key} cell={r.cells[c.key]} />)}
      <td className="border-t border-line px-2">
        <div className="flex items-center justify-end gap-2">
          <i className="block h-3 rounded-sm" style={{ width: (Math.abs(r.score) / max) * 70, background: r.score >= 0 ? 'var(--win)' : 'var(--loss)' }} />
          <b className="num text-xs" style={{ color: r.score >= 0 ? 'var(--win)' : 'var(--loss)' }}>{sign(r.score, 2)}</b>
        </div>
      </td>
    </tr>
  );
  const band = (text: string, tone: string) => (
    <tr><td colSpan={data.columns.length + 3} className="px-3 py-1.5 text-sm font-extrabold uppercase tracking-wide" style={{ color: tone, background: `color-mix(in srgb, ${tone} 16%, transparent)` }}>{text}</td></tr>
  );
  return (
    <section aria-labelledby={id} className="card overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-3">
        <h2 id={id} className="text-sm font-semibold uppercase tracking-wide">{pos} volume trends</h2>
        <span className="text-xs text-muted">{season} · weeks {data.weeks[0]}–{data.weeks[data.weeks.length - 1]} · last two weeks against the weeks before</span>
      </div>
      <p className="px-4 text-sm text-muted">Whose role is growing, and whose is shrinking?</p>
      <div className="overflow-x-auto px-2 pb-2">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead><tr>
            <th /><th className="px-2 text-left text-[10.5px] uppercase tracking-wide text-muted">Player</th>
            {data.columns.map((c) => <th key={c.key} className="px-1.5 text-[10.5px] uppercase tracking-wide text-muted">{c.label}<div className="text-[9.5px] normal-case tracking-normal">Wk {data.weeks.join(' · ')}</div></th>)}
            <th className="px-2 text-right text-[10.5px] uppercase tracking-wide text-muted">Trend</th>
          </tr></thead>
          <tbody>
            {band('▲ Trending up', 'var(--win)')}
            {data.up.map(row)}
            {band('▼ Trending down', 'var(--loss)')}
            {data.down.map(row)}
          </tbody>
        </table>
      </div>
      {data.injured.length > 0 && (
        <p className="border-t border-line px-4 py-2 text-xs"><b>Injured</b> <span className="text-muted">(left out of the lists): </span>
          {data.injured.map((p, i) => <span key={p.id}>{i > 0 && ' · '}{p.name}: {p.status}{p.injury ? ` (${p.injury})` : ''}</span>)}
        </p>
      )}
      <p className="border-t border-line px-4 py-2 text-[11px] text-muted">Each bar is one week: dotted is a bye, empty is a missed game, faint with ✚ is a game he left injured. Those don&apos;t count toward the change. The coloured bar is his latest healthy week. Trend averages each change, scaled by how much that stat usually moves.</p>
    </section>
  );
}
