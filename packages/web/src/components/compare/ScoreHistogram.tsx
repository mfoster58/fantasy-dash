import { BIN_COUNT } from '../../lib/compare/summary';

const W = 240, H = 56, BW = W / BIN_COUNT, MAX_PTS = 50;

/** His weekly scores in 5-point bins, 45+ in the last, with a dashed line at his average. */
export default function ScoreHistogram({ bins, avg, index }: { bins: number[]; avg: number | null; index: number }) {
  const most = Math.max(1, ...bins);
  const grad = `hist-${index}`;
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="block w-full" role="img" aria-label="Weekly scores">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: `var(--slot-${index})` }} />
          <stop offset="1" style={{ stopColor: `var(--slot-${index})`, stopOpacity: 0.35 }} />
        </linearGradient>
      </defs>
      {bins.map((b, k) => (
        <rect key={k} data-bin={k} x={k * BW + 1} y={H - (b / most) * H} width={BW - 2} height={b ? (b / most) * H : 1} rx={2}
          style={{ fill: b ? `url(#${grad})` : 'var(--line)' }} />
      ))}
      {avg !== null && <line x1={(Math.min(avg, MAX_PTS) / MAX_PTS) * W} x2={(Math.min(avg, MAX_PTS) / MAX_PTS) * W} y1={0} y2={H} strokeDasharray="2 2" style={{ stroke: 'var(--ink)', opacity: 0.6 }} />}
      {[0, 15, 30, 45].map((v) => (
        <text key={v} x={(v / MAX_PTS) * W} y={H + 12} fontSize={9} textAnchor={v ? 'middle' : 'start'} style={{ fill: 'var(--muted)' }}>{v === 45 ? '45+' : v}</text>
      ))}
    </svg>
  );
}
