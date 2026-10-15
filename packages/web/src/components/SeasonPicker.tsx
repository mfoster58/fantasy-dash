interface Props { years: number[]; value: number | 'all'; onChange: (v: number | 'all') => void; allTime?: boolean }

export default function SeasonPicker({ years, value, onChange, allTime = false }: Props) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Season
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        className="num rounded border border-line bg-surface px-2 py-1 text-ink"
      >
        {allTime && <option value="all">All-time</option>}
        {[...years].sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </label>
  );
}
