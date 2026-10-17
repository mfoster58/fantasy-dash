import type { Manager, PlayerDirectory, PlayerId, UserId } from '@fantasy-dash/core';
import Headshot from '../Headshot';
import { CoverLink, TeamLink } from '../NameLink';
import PosPill from '../PosPill';
import { CardHeader } from '../draft/DraftAnalysis';
import { fmtPts, fmtTag } from '../../lib/format';
import { playerName, playerPos, playerTeam } from '../../lib/players';
import type { BestStart } from '../../lib/teamProfile';

interface Props {
  label: string; title: string; rows: BestStart[]; empty: string;
  players: PlayerDirectory; seasonTeams: Record<PlayerId, string>; managers: Record<UserId, Manager>; year: number;
}

/** A short leaderboard of single-week starts: player, the week and opponent, and the points; each row opens the box score, the opponent opens their team page. */
export default function TopStarts({ label, title, rows, empty, players, seasonTeams, managers, year }: Props) {
  return (
    <section className="card">
      <CardHeader label={label} title={title} />
      {rows.length === 0 ? <p className="px-4 py-3 text-xs text-muted">{empty}</p> : (
        <ol className="divide-y divide-line">
          {rows.map((r, i) => {
            const opp = managers[r.opponentId];
            return (
              <li key={`${r.playerId}-${r.week}`} className="relative hover:bg-surface-2">
                <CoverLink to={`/scores/${year}/${r.week}/${r.matchupId}`} label={`Week ${r.week} box score`} />
                <div className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="num w-4 text-xs text-muted">{i + 1}</span>
                  <Headshot players={players} id={r.playerId} size={26} />
                  <PosPill pos={playerPos(players, r.playerId)} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate"><span className="font-medium">{playerName(players, r.playerId)}</span> <span className="text-xs text-muted">{playerTeam(players, r.playerId, seasonTeams)}</span></span>
                    <span className="block truncate text-xs text-muted">Week {r.week} vs <TeamLink userId={r.opponentId} year={year} className="relative z-10">{opp?.teamName ?? opp?.displayName ?? r.opponentId}</TeamLink>{r.tag ? ` · ${fmtTag(r.tag)}` : ''}</span>
                  </span>
                  <span className="num text-base font-semibold">{fmtPts(r.points)}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
