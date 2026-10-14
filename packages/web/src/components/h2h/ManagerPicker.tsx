import type { History } from '@fantasy-dash/core';

interface Props { label: string; value: string; onChange: (id: string) => void; managers: History['managers']; exclude?: string }

export default function ManagerPicker({ label, value, onChange, managers, exclude }: Props) {
  const options = Object.entries(managers)
    .filter(([id]) => id !== exclude)
    .sort(([, x], [, y]) => x.displayName.localeCompare(y.displayName));
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded border border-line bg-surface px-2 py-1 text-ink">
        <option value="">Choose a manager</option>
        {options.map(([id, m]) => <option key={id} value={id}>{m.displayName}</option>)}
      </select>
    </label>
  );
}
