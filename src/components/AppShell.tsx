import { useEffect, useRef, useState } from 'react';
import { Search, UserCircle, X } from 'lucide-react';
import { Avatar } from './ui';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';

export function AppShell({ children }: { children?: React.ReactNode }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const state = useStore();
  const { users } = state;
  const { setView } = useUI();

  // Close search dropdown when clicking anywhere outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Filter users based on query
  const trimmed = query.trim().toLowerCase();
  const safeUsers = Array.isArray(users) ? users : [];
  const matchingUsers = trimmed
    ? safeUsers.filter(
        (u) =>
          u?.name?.toLowerCase().includes(trimmed) ||
          (u?.parish && u.parish.toLowerCase().includes(trimmed))
      )
    : [];

  const handleSelectUser = (userId: string) => {
    setIsOpen(false);
    setQuery('');
    setView('profile');
  };

  return (
    <div className="relative min-h-screen bg-ink-950 text-ink-100">
      {/* Top Search Bar / Header Wrapper */}
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-ink-700/60 bg-ink-900/80 px-4 backdrop-blur-md">
        {/* Facebook-Style Search Input & Floating Dropdown */}
        <div ref={containerRef} className="relative w-full max-w-md">
          <div className="relative flex items-center">
            <Search size={18} className="absolute left-3.5 text-ink-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onFocus={() => setIsOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              placeholder="SEARCH PEOPLE, CHURCHES, GROUPS..."
              className="w-full rounded-full border border-ink-700 bg-ink-850 py-2 pl-10 pr-9 text-xs tracking-wider uppercase text-ink-100 placeholder-ink-400 outline-none transition-all focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20"
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setIsOpen(false);
                }}
                className="absolute right-3 rounded-full p-1 text-ink-400 hover:bg-ink-750 hover:text-ink-100"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {/* Floating Dropdown Results (Non-Blocking) */}
          {isOpen && trimmed.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 max-h-80 overflow-y-auto rounded-2xl border border-ink-700 bg-ink-850 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2">
              {matchingUsers.length > 0 ? (
                <div className="space-y-1">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gold-400">
                    People & Parishes
                  </div>
                  {matchingUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectUser(u.id)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-ink-750"
                    >
                      <Avatar src={u.photo} name={u.name} size={36} ring="gold" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink-100">{u.name}</div>
                        <div className="truncate text-xs text-ink-400">{u.parish || 'Orthodox Member'}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-ink-400">
                  No matches found for "{query}"
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main App View Area */}
      <main>{children}</main>
    </div>
  );
}
