import { useState } from 'react';
import { applyTheme, getTheme, type Theme } from '../lib/theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getTheme());
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={() => { applyTheme(next); setTheme(next); }}
      className="h-11 rounded-lg px-2.5 text-sm text-muted transition-colors hover:text-ink md:h-auto md:px-2 md:py-1 md:text-xs"
      aria-label={`Switch to ${next} theme`}
    >
      {next === 'light' ? 'Light' : 'Dark'}
    </button>
  );
}
