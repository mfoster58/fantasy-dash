import { Link } from 'react-router';
import type { DraftPick, PlayerDirectory, PlayerId } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import PosPill from '../PosPill';
import { CardHeader, signClass } from '../draft/DraftAnalysis';
import { fmtSigned } from '../../lib/format';
import { pickLabel } from '../../lib/draft';
import { playerName, playerPos, playerTeam } from '../../lib/players';

interface Props { picks: DraftPick[]; teams: number; grade: string | null; value: number | null; year: number; players: PlayerDirectory; seasonTeams: Record<PlayerId, string> }

/** The manager's draft, pick by pick, with the rank-based grade and each pick's value. */
export default function TeamPicks({ picks, teams, grade, value, year, players, seasonTeams }: Props) {
  return (
    <section className="card">
      <CardHeader
        label={`${year} draft`} title="Picks"
        aside={grade && <span className="flex items-baseline gap-2"><span className={`num text-sm font-semibold ${signClass(value)}`}>{value === null ? '' : fmtSigned(value, 0)}</span><span className="rounded bg-ink px-2 py-0.5 text-base font-bold text-bg">{grade}</span></span>}
      />
      <ul className="divide-y divide-line">
        {picks.map((p) => (
          <li key={p.pickNo} className="flex items-center gap-3 px-4 py-2 text-sm">
            <span className="num w-9 text-xs text-muted">{pickLabel(p, teams)}</span>
            <Headshot players={players} id={p.playerId} size={26} />
            <PosPill pos={playerPos(players, p.playerId)} />
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium">{playerName(players, p.playerId)}</span>
              <span className="ml-1.5 text-xs text-muted">{playerTeam(players, p.playerId, seasonTeams)}</span>
              {p.isKeeper && <span className="ml-1.5 rounded bg-surface-2 px-1 text-[9px] font-semibold uppercase tracking-wide text-muted">kept</span>}
            </span>
            <span className={`num rounded px-1.5 py-0.5 text-xs font-semibold ${p.value === null ? 'text-muted' : p.value > 0 ? 'bg-win/15 text-win' : p.value < 0 ? 'bg-loss/15 text-loss' : 'bg-surface-2 text-muted'}`}>
              {p.value === null ? '—' : fmtSigned(p.value, 0)}
            </span>
          </li>
        ))}
      </ul>
      <Link to={`/draft/${year}`} className="block border-t border-line px-4 py-2 text-xs text-accent hover:bg-surface-2">See full draft board →</Link>
    </section>
  );
}
