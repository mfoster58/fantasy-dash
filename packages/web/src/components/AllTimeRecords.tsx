import { Link } from 'react-router';
import type { History, PlayoffTag, UserId } from '@fantasy-dash/core';
import Avatar from './Avatar';
import { fmtPts, fmtSigned, fmtTag } from '../lib/format';
import type { AllTimeRecords as Records, MatchupEntry, ScoreEntry } from '../lib/allTimeRecords';

interface Props { records: Records; managers: History['managers'] }

const linkFor = (gameId: string) => {
  const [year, week, matchupId] = gameId.split('-');
  return `/scores/${year}/${week}/${matchupId}`;
};

const when = (g: { year: number; week: number; tag: PlayoffTag | null }) =>
  `${g.year} · Wk ${g.week}${g.tag ? ` · ${fmtTag(g.tag)}` : ''}`;

const row = 'flex items-center gap-3 px-3 py-2 transition-colors hover:bg-surface-2';

function Card({ id, title, note, count, children }: { id: string; title: string; note: string; count: number; children: React.ReactNode }) {
  return (
    <div data-testid={`records-${id}`} className="card overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-line px-3 py-2">
        <h2 className="section-label">{title}</h2>
        <span className="text-xs text-muted">{note}</span>
      </div>
      {count === 0 ? <p className="px-3 py-4 text-sm text-muted">No games yet.</p> : <ol className="divide-y divide-line">{children}</ol>}
    </div>
  );
}

function Name({ userId, managers, size = 24 }: { userId: UserId; managers: History['managers']; size?: number }) {
  const m = managers[userId];
  const name = m?.displayName ?? userId;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar avatar={m?.avatar ?? null} name={name} size={size} />
      <span className="truncate font-medium">{name}</span>
    </span>
  );
}

function ScoreRow({ e, rank, managers }: { e: ScoreEntry; rank: number; managers: History['managers'] }) {
  return (
    <li>
      <Link to={linkFor(e.gameId)} className={row}>
        <span className="num w-5 shrink-0 text-right text-xs text-muted">{rank}</span>
        <span className="min-w-0 flex-1">
          <Name userId={e.userId} managers={managers} />
          <span className="mt-0.5 block truncate text-xs text-muted">
            {when(e)} · vs {managers[e.opponent]?.displayName ?? e.opponent} <span className="num">{fmtPts(e.oppPoints)}</span>
          </span>
        </span>
        <span className="num shrink-0 text-lg font-semibold">{fmtPts(e.points)}</span>
      </Link>
    </li>
  );
}

function MatchupRow({ e, rank, managers }: { e: MatchupEntry; rank: number; managers: History['managers'] }) {
  const tie = e.margin === 0;
  return (
    <li>
      <Link to={linkFor(e.gameId)} className={row}>
        <span className="num w-5 shrink-0 text-right text-xs text-muted">{rank}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm">
            <Name userId={e.high.userId} managers={managers} size={20} />
            <span className="num shrink-0">{fmtPts(e.high.points)}</span>
            <span className="shrink-0 text-muted">–</span>
            <span className="num shrink-0 text-muted">{fmtPts(e.low.points)}</span>
            <span className="min-w-0 truncate text-muted">{managers[e.low.userId]?.displayName ?? e.low.userId}</span>
          </span>
          <span className="mt-0.5 block text-xs text-muted">{when(e)}</span>
        </span>
        <span className={`num shrink-0 text-lg font-semibold ${tie ? 'text-muted' : ''}`}>{tie ? 'Tie' : fmtSigned(e.margin, 2)}</span>
      </Link>
    </li>
  );
}

export default function AllTimeRecords({ records, managers }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card id="highScores" title="High scores" note="Best single week" count={records.highScores.length}>
        {records.highScores.map((e, i) => <ScoreRow key={`${e.gameId}-${e.userId}`} e={e} rank={i + 1} managers={managers} />)}
      </Card>
      <Card id="lowScores" title="Low scores" note="Worst single week" count={records.lowScores.length}>
        {records.lowScores.map((e, i) => <ScoreRow key={`${e.gameId}-${e.userId}`} e={e} rank={i + 1} managers={managers} />)}
      </Card>
      <Card id="closest" title="Closest matchups" note="Smallest margin" count={records.closest.length}>
        {records.closest.map((e, i) => <MatchupRow key={e.gameId} e={e} rank={i + 1} managers={managers} />)}
      </Card>
      <Card id="blowouts" title="Blowouts" note="Largest margin" count={records.blowouts.length}>
        {records.blowouts.map((e, i) => <MatchupRow key={e.gameId} e={e} rank={i + 1} managers={managers} />)}
      </Card>
    </div>
  );
}
