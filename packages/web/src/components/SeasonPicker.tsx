interface Props { years: number[]; value: number; onChange: (year: number) => void }

export default function SeasonPicker({ years, value, onChange }: Props) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Season
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="num rounded border border-line bg-surface px-2 py-1 text-ink"
      >
        {[...years].sort((a, b) => b - a).map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </label>
  );
}
