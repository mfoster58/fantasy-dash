import { useState } from 'react';
import { applyTheme, getTheme, type Theme } from '../lib/theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getTheme());
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => { applyTheme(next); setTheme(next); }}
      className="rounded px-2 py-1 text-xs text-muted transition-colors hover:text-ink"
      aria-label={`Switch to ${next} theme`}
    >
      {next === 'light' ? 'Light' : 'Dark'}
    </button>
  );
}
