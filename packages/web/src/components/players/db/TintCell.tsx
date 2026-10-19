import { fmtValue, type ColumnDef, type Mode } from '../../../lib/playerdb/columns';

/** a column that stays put while the table scrolls sideways: its left offset and the opaque colour under its tint */
export interface Stick { left: string; width: string; under?: string; edge?: boolean }
interface Props { value: number | null; col: ColumnDef; mode: Mode; tint: string; dim: boolean; est: boolean; stick?: Stick }

/** One numeric cell: percentile tint behind normal ink, muted when under the sample minimum, ° after an estimated route number. */
export default function TintCell({ value, col, mode, tint, dim, est, stick }: Props) {
  const text = fmtValue(value, col.fmt, col.perGame ? mode : 'total');
  const tone = col.fmt === 'signed1' && value !== null && value !== 0 ? (value > 0 ? 'text-win' : 'text-loss') : '';
  return (
    <td data-testid={`cell-${col.key}`} className={`num whitespace-nowrap px-2 py-1.5 text-center ${dim || value === null ? 'text-muted' : tone} ${stick ? `sticky z-[1] ${stick.edge ? 'shadow-[inset_-1px_0_0_var(--line)]' : ''}` : ''}`}
      style={stick
        ? { left: stick.left, width: stick.width, minWidth: stick.width, maxWidth: stick.width, backgroundColor: stick.under ?? 'var(--surface)', backgroundImage: dim || tint === 'transparent' ? undefined : `linear-gradient(${tint}, ${tint})` }
        : dim || tint === 'transparent' ? undefined : { background: tint }}>
      {text}{est && value !== null ? <span className="text-muted">°</span> : null}
    </td>
  );
}
