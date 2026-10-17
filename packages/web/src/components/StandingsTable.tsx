import type { Manager, StandingRow, UserId } from '@fantasy-dash/core';
import Avatar from './Avatar';
import { ManagerLink, TeamLink } from './NameLink';
import { fmtPct, fmtPpg, fmtPts, fmtWinPct } from '../lib/format';
import { METRIC_DEFS } from '../lib/metrics';

interface Props { rows: StandingRow[]; managers: Record<UserId, Manager>; playoffTeams: number; year: number }

const headers: { key: string; label: string; title?: string; left?: boolean }[] = [
  { key: 'rank', label: '#', left: true },
  { key: 'team', label: 'Team', left: true },
  { key: 'w', label: 'W' },
  { key: 'l', label: 'L' },
  { key: 't', label: 'T' },
  { key: 'pct', label: 'Win%', title: METRIC_DEFS.winPct },
  { key: 'pf', label: 'PF', title: METRIC_DEFS.pf },
  { key: 'pa', label: 'PA', title: METRIC_DEFS.pa },
  { key: 'ppg', label: 'PPG', title: METRIC_DEFS.ppg },
  { key: 'max', label: 'Max', title: METRIC_DEFS.max },
  { key: 'eff', label: 'Eff', title: METRIC_DEFS.eff },
  { key: 'strk', label: 'Strk', title: METRIC_DEFS.strk },
  { key: 'ap', label: 'All-Play', title: METRIC_DEFS.allPlay },
];

const cell = 'num whitespace-nowrap px-3 py-2.5 text-right';

export default function StandingsTable({ rows, managers, playoffTeams, year }: Props) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-line">
          <tr>
            {headers.map((h) => (
              <th key={h.key} scope="col" title={h.title} className={`section-label whitespace-nowrap px-3 py-2.5 ${h.key === 'rank' ? 'w-10 pl-4 pr-1' : ''} ${h.key === 'team' ? 'w-[32%] min-w-56' : ''} ${h.left ? 'text-left' : 'text-right'}`}>
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const m = managers[r.userId];
            const cut = i === playoffTeams - 1 && i < rows.length - 1;
            const streakTone = r.streak.startsWith('W') ? 'text-win' : r.streak.startsWith('L') ? 'text-loss' : 'text-muted';
            return (
              <tr
                key={r.userId}
                data-testid="standings-row"
                data-playoff-cut={cut ? 'true' : undefined}
                className={`border-t border-line transition-colors first:border-t-0 hover:bg-surface-2/70 ${cut ? 'border-b-2 border-b-accent/60' : ''}`}
              >
                <td className="num py-2.5 pl-4 pr-1 text-muted">{r.rank}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Avatar avatar={m?.avatar ?? null} name={m?.displayName ?? '?'} size={28} />
                    <div className="min-w-0 leading-tight">
                      <TeamLink userId={r.userId} year={year} className="block truncate font-medium">{m?.teamName ?? m?.displayName ?? r.userId}</TeamLink>
                      {m?.teamName && <ManagerLink userId={r.userId} className="block text-xs text-muted">{m.displayName}</ManagerLink>}
                    </div>
                  </div>
                </td>
                <td className={cell}>{r.w}</td>
                <td className={cell}>{r.l}</td>
                <td className={`${cell} text-muted`}>{r.t}</td>
                <td className={cell}>{fmtWinPct(r.winPct)}</td>
                <td className={cell}>{fmtPts(r.pf)}</td>
                <td className={`${cell} text-muted`}>{fmtPts(r.pa)}</td>
                <td className={cell}>{fmtPpg(r.ppg)}</td>
                <td className={`${cell} text-muted`}>{fmtPts(r.maxPoints)}</td>
                <td className={cell}>{fmtPct(r.efficiency)}</td>
                <td className={`${cell} ${streakTone}`}>{r.streak}</td>
                <td className={cell}>
                  {r.allPlay.w}-{r.allPlay.l}{r.allPlay.t ? `-${r.allPlay.t}` : ''}{' '}
                  <span className="text-muted">({fmtWinPct(r.allPlay.pct)})</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
