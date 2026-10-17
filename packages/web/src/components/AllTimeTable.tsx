import { Link } from 'react-router';
import type { AllTimeRow, History } from '@fantasy-dash/core';
import Avatar from './Avatar';
import { fmtPct, fmtPpg, fmtPts, fmtWinPct } from '../lib/format';
import { METRIC_DEFS } from '../lib/metrics';

interface Props { rows: AllTimeRow[]; managers: History['managers'] }

const headers: { key: string; label: string; title?: string; left?: boolean }[] = [
  { key: 'rank', label: '#', left: true },
  { key: 'mgr', label: 'Manager', left: true },
  { key: 'seasons', label: 'Yrs', title: METRIC_DEFS.seasons },
  { key: 'w', label: 'W' }, { key: 'l', label: 'L' }, { key: 't', label: 'T' },
  { key: 'pct', label: 'Win%', title: METRIC_DEFS.winPct },
  { key: 'pf', label: 'PF', title: METRIC_DEFS.pf },
  { key: 'pa', label: 'PA', title: METRIC_DEFS.pa },
  { key: 'ppg', label: 'PPG', title: METRIC_DEFS.ppg },
  { key: 'max', label: 'Max', title: METRIC_DEFS.max },
  { key: 'eff', label: 'Eff', title: METRIC_DEFS.eff },
  { key: 'strk', label: 'Strk', title: METRIC_DEFS.strk },
  { key: 'ap', label: 'All-Play', title: METRIC_DEFS.allPlay },
  { key: 'titles', label: 'Titles', title: METRIC_DEFS.titles },
  { key: 'second', label: '2nd', title: METRIC_DEFS.runnerUps },
  { key: 'third', label: '3rd', title: METRIC_DEFS.thirds },
  { key: 'apps', label: 'PO Apps', title: METRIC_DEFS.playoffApps },
  { key: 'powins', label: 'PO Wins', title: METRIC_DEFS.playoffWins },
  { key: 'tb', label: 'Toilet', title: METRIC_DEFS.toiletBowls },
];

const cell = 'num px-3 py-2 text-right whitespace-nowrap';
const honor = (n: number) => (n > 0 ? <span className="text-ink">{n}</span> : <span className="text-muted/60">0</span>);

export default function AllTimeTable({ rows, managers }: Props) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            {headers.map((h) => (
              <th key={h.key} scope="col" title={h.title} className={`section-label px-3 py-2 ${h.left ? 'text-left' : 'text-right'}`}>{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const m = managers[r.userId];
            const name = m?.displayName ?? r.userId;
            const tone = r.streak.startsWith('W') ? 'text-win' : r.streak.startsWith('L') ? 'text-loss' : 'text-muted';
            return (
              <tr key={r.userId} data-testid="alltime-row" className="border-t border-line transition-colors hover:bg-surface-2">
                <td className="num w-10 px-3 py-2 text-muted">{r.rank}</td>
                <td className="px-3 py-2">
                  <Link to={`/managers/${r.userId}`} className="flex items-center gap-2 hover:text-accent">
                    <Avatar avatar={m?.avatar ?? null} name={name} size={24} />
                    <span className="font-medium">{name}</span>
                  </Link>
                </td>
                <td className={cell}>{r.seasons}</td>
                <td className={cell}>{r.w}</td>
                <td className={cell}>{r.l}</td>
                <td className={`${cell} text-muted`}>{r.t}</td>
                <td className={cell}>{fmtWinPct(r.winPct)}</td>
                <td className={cell}>{fmtPts(r.pf)}</td>
                <td className={`${cell} text-muted`}>{fmtPts(r.pa)}</td>
                <td className={cell}>{fmtPpg(r.ppg)}</td>
                <td className={`${cell} text-muted`}>{fmtPts(r.maxPoints)}</td>
                <td className={cell}>{fmtPct(r.efficiency)}</td>
                <td className={`${cell} ${tone}`}>{r.streak}</td>
                <td className={cell}>{r.allPlay.w}-{r.allPlay.l}{r.allPlay.t ? `-${r.allPlay.t}` : ''} <span className="text-muted">({fmtWinPct(r.allPlay.pct)})</span></td>
                <td className={cell}>{honor(r.titles)}</td>
                <td className={cell}>{honor(r.runnerUps)}</td>
                <td className={cell}>{honor(r.thirds)}</td>
                <td className={cell}>{honor(r.playoffApps)}</td>
                <td className={cell}>{honor(r.playoffWins)}</td>
                <td className={cell}>{honor(r.toiletBowls)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
