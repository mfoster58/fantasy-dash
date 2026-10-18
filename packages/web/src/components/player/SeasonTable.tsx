import Avatar from '../Avatar';
import { FinishIcon } from '../Icons';
import { ManagerLink } from '../NameLink';
import { history } from '../../data/load';
import type { BestKey, SeasonTable as Table } from '../../lib/player/seasons';

const f1 = (v: number | null) => (v === null ? '–' : v.toFixed(1));
const rec = (r: { w: number; l: number; t: number }) => `${r.w}–${r.l}${r.t ? `–${r.t}` : ''}`;
const cell = 'num px-2 py-2 text-center';
const HEADS = ['Season', 'Manager', 'Starts', 'Rostered', 'Bench+', 'Total', 'PPG', 'Best', 'Pos', 'Overall', 'W–L started', 'Playoff pts'];

/** One row per league season, gold for a title season and for each column's career best, then the career row. */
export default function SeasonTable({ table, pos }: { table: Table; pos: string }) {
  const gold = (k: BestKey, v: number | null) => (v !== null && table.best[k] === v ? 'font-semibold text-gold' : '');
  const name = (u: string) => history.managers[u]?.displayName ?? u;
  const c = table.career;
  return (
    <section aria-labelledby="pp-league" className="card overflow-auto">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 pb-2 pt-3">
        <h2 id="pp-league" className="text-sm font-semibold uppercase tracking-wide">In this league</h2>
        <span className="text-xs text-muted">Gold row: title season · gold number: career best</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="section-label text-[10px]">
            <th colSpan={2} />
            {[['Starts', 3], ['Points', 3], ['Rank', 2], ['Team', 2]].map(([g, n]) => <th key={g} colSpan={n as number} className="border-b border-line px-2 pt-2 pb-1">{g}</th>)}
          </tr>
          <tr className="section-label text-[11px]">{HEADS.map((h, i) => <th key={h} className={`whitespace-nowrap px-2 py-2 ${i < 2 ? 'text-left' : 'text-center'}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.year} data-title={r.title ? 'true' : undefined}
              className={`border-t border-line ${r.title ? 'bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] shadow-[inset_3px_0_0_var(--gold)]' : ''}`}>
              <td className="num whitespace-nowrap px-3 py-2">{r.year}{r.title && <FinishIcon kind="champion" size="1em" className="ml-1.5" />}</td>
              <td className="px-2 py-2">
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  {r.managers.map((u, i) => (
                    <span key={u} className="flex items-center gap-1.5">
                      {i > 0 && <span className="text-muted">→</span>}
                      <Avatar avatar={history.managers[u]?.avatar ?? null} name={name(u)} size={20} />
                      <ManagerLink userId={u}>{name(u)}</ManagerLink>
                    </span>
                  ))}
                </span>
              </td>
              <td className={`${cell} ${gold('starts', r.starts)}`}>{r.starts}</td>
              <td className={cell}>{r.rostered}</td>
              <td className={cell}>{f1(r.benchPts)}</td>
              <td className={`${cell} ${gold('pts', r.pts)}`}>{f1(r.pts)}</td>
              <td className={`${cell} ${gold('ppg', r.ppg)}`}>{f1(r.ppg)}</td>
              <td className={`${cell} ${gold('best', r.best)}`}>{f1(r.best)}</td>
              <td className={`${cell} ${gold('posRank', r.posRank)}`}>{r.posRank === null ? '–' : `${pos}${r.posRank}`}</td>
              <td className={`${cell} ${gold('overallRank', r.overallRank)}`}>{r.overallRank ?? '–'}</td>
              <td className={cell}>{rec(r)}</td>
              <td className={`${cell} ${gold('playoffPts', r.playoffPts)}`}>{f1(r.playoffPts)}</td>
            </tr>
          ))}
          <tr className="border-t border-line bg-surface-2 font-semibold">
            <td className="px-3 py-2">Career</td>
            <td className="px-2 py-2 font-normal text-muted">{c.managers} manager{c.managers === 1 ? '' : 's'}</td>
            <td className={cell}>{c.starts}</td><td className={cell}>{c.rostered}</td><td className={cell}>{f1(c.benchPts)}</td>
            <td className={cell}>{f1(c.pts)}</td><td className={cell}>{f1(c.ppg)}</td><td className={cell}>{f1(c.best)}</td>
            <td className={cell} /><td className={cell} />
            <td className={cell}>{rec(c)}</td><td className={cell}>{f1(c.playoffPts)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
