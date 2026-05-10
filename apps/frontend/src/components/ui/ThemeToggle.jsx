import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore.js';
import { useEffect } from 'react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <button
      id="theme-toggle"
      onClick={toggleTheme}
      className="p-2.5 rounded-xl bg-surface-800/50 border border-white/5 hover:bg-surface-700/50 hover:border-white/10 transition-all duration-200 group relative"
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <div className="relative w-5 h-5 flex items-center justify-center">
        {theme === 'dark' ? (
          <Sun size={20} className="text-amber-400 animate-in fade-in zoom-in duration-300" />
        ) : (
          <Moon size={20} className="text-indigo-400 animate-in fade-in zoom-in duration-300" />
        )}
      </div>
      
      {/* Tooltip hint on hover */}
      <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-surface-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-white/10">
        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
      </span>
    </button>
  );
}
