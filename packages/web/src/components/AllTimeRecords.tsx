import { Link } from 'react-router';
import type { History, PlayoffTag, UserId } from '@fantasy-dash/core';
import Avatar from './Avatar';
import { fmtPts, fmtTag } from '../lib/format';
import type { AllTimeRecords as Records, MatchupEntry, ScoreEntry } from '../lib/allTimeRecords';

interface Props { records: Records; managers: History['managers'] }
type Managers = History['managers'];

const linkFor = (gameId: string) => {
  const [year, week, matchupId] = gameId.split('-');
  return `/scores/${year}/${week}/${matchupId}`;
};

const row = 'block px-3 py-2.5 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none';

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

/** Mirrors the scoreboard card's header: context on the left, the row's headline fact on the right. */
function RowHeader({ rank, game, right }: { rank: number; game: { year: number; week: number; tag: PlayoffTag | null }; right: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="flex min-w-0 items-baseline gap-1.5 text-muted">
        <span className="num w-4 shrink-0">{rank}</span>
        <span className="num whitespace-nowrap">{game.year} · Wk {game.week}{game.tag && ' · '}</span>
        {game.tag && <span className="truncate font-semibold text-accent">{fmtTag(game.tag)}</span>}
      </span>
      {right}
    </div>
  );
}

function Team({ userId, points, managers, align, lost }: { userId: UserId; points: number; managers: Managers; align: 'left' | 'right'; lost: boolean }) {
  const m = managers[userId];
  const name = m?.displayName ?? userId;
  const right = align === 'right';
  return (
    <span className={`flex min-w-0 items-center gap-2 ${right ? 'flex-row-reverse text-right' : ''} ${lost ? 'text-muted' : ''}`}>
      <Avatar avatar={m?.avatar ?? null} name={name} size={32} />
      <span className={`min-w-0 flex-1 truncate text-sm leading-tight ${lost ? '' : 'font-semibold'}`} title={name}>{name}</span>
      <span className={`num shrink-0 text-xl leading-none ${lost ? '' : 'font-semibold text-ink'}`}>{fmtPts(points)}</span>
    </span>
  );
}

function ScoreRow({ e, rank, managers }: { e: ScoreEntry; rank: number; managers: Managers }) {
  const opp = managers[e.opponent]?.displayName ?? e.opponent;
  return (
    <li>
      <Link to={linkFor(e.gameId)} className={row}>
        <RowHeader rank={rank} game={e} right={<span className="truncate text-muted">vs {opp} <span className="num">{fmtPts(e.oppPoints)}</span></span>} />
        <div className="mt-1.5">
          <Team userId={e.userId} points={e.points} managers={managers} align="left" lost={false} />
        </div>
      </Link>
    </li>
  );
}

function MatchupRow({ e, rank, managers }: { e: MatchupEntry; rank: number; managers: Managers }) {
  const tie = e.margin === 0;
  return (
    <li>
      <Link to={linkFor(e.gameId)} className={row}>
        <RowHeader rank={rank} game={e} right={<span className="section-label shrink-0 text-ink">{tie ? 'Tie' : <>by <span className="num">{fmtPts(e.margin)}</span></>}</span>} />
        <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3">
          <Team userId={e.high.userId} points={e.high.points} managers={managers} align="left" lost={false} />
          <span className="section-label px-0.5 text-[12px] lowercase tracking-[0.12em]" style={{ fontVariant: 'small-caps' }}>vs</span>
          <Team userId={e.low.userId} points={e.low.points} managers={managers} align="right" lost={!tie} />
        </div>
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
