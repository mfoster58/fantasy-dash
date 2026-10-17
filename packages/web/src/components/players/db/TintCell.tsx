import { fmtValue, type ColumnDef, type Mode } from '../../../lib/playerdb/columns';

interface Props { value: number | null; col: ColumnDef; mode: Mode; tint: string; dim: boolean; est: boolean }

/** One numeric cell: percentile tint behind normal ink, muted when under the sample minimum, ° after an estimated route number. */
export default function TintCell({ value, col, mode, tint, dim, est }: Props) {
  const text = fmtValue(value, col.fmt, col.perGame ? mode : 'total');
  const tone = col.fmt === 'signed1' && value !== null && value !== 0 ? (value > 0 ? 'text-win' : 'text-loss') : '';
  return (
    <td data-testid={`cell-${col.key}`} className={`num whitespace-nowrap px-2 py-1.5 text-right ${dim || value === null ? 'text-muted' : tone}`} style={dim || tint === 'transparent' ? undefined : { background: tint }}>
      {text}{est && value !== null ? <span className="text-muted">°</span> : null}
    </td>
  );
}
