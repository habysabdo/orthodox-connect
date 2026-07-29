import { useEffect, useMemo, useRef, useState } from 'react';
import { Church, Clapperboard, Music, Search, Users, X } from 'lucide-react';
import { Avatar, Modal, Spinner } from './ui';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
import {
  EMPTY_RESULTS,
  search,
  totalCount,
  type SearchChurch,
  type SearchResults,
  type SearchSong,
} from '@/utils/search';

type Tab = 'all' | 'people' | 'churches' | 'songs' | 'videos';

const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'people', label: 'People' },
  { key: 'churches', label: 'Churches' },
  { key: 'songs', label: 'Songs' },
  { key: 'videos', label: 'Videos' },
];

export function GlobalSearch({ className = '' }: { className?: string }) {
  const { users, currentUserId, openThreadWith } = useStore();
  const { setView, setOpenThreadId, openReel } = useUI();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('all');
  const [church, setChurch] = useState<SearchChurch | null>(null);
  const [song, setSong] = useState<SearchSong | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Debounced live search. Each keystroke cancels the previous request.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const handle = setTimeout(() => {
      search(q, controller.signal)
        .then((r) => setResults(r))
        .catch((err) => {
          if ((err as Error).name !== 'AbortError') console.error('Search failed', err);
        })
        .finally(() => setLoading(false));
    }, 220);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [query]);

  // Close the dropdown on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // When the mobile full-screen overlay is open, focus the input, lock body
  // scroll, and let Escape dismiss it.
  useEffect(() => {
    if (!mobileOpen) return;
    mobileInputRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileOpen]);

  // Never suggest messaging yourself.
  const people = useMemo(
    () => (results.people ?? []).filter((p) => p?.id !== currentUserId),
    [results.people, currentUserId],
  );

  const count = totalCount({ ...results, people });
  const show = (t: Tab) => tab === 'all' || tab === t;

  const reset = () => {
    setOpen(false);
    setMobileOpen(false);
    setQuery('');
    setResults(EMPTY_RESULTS);
    setTab('all');
  };

  const messagePerson = (id: string) => {
    const tid = openThreadWith(id);
    setOpenThreadId(tid);
    setView('messenger');
    reset();
  };

  const watchVideo = (id: string) => {
    openReel(id);
    reset();
  };

  const authorName = (authorId: string) =>
    users.find((u) => u?.id === authorId)?.name ?? 'Community member';

  const hasQuery = query.trim().length > 0;

  // Category tabs — shared between the desktop dropdown and the mobile overlay.
  const tabsRow = (
    <div className="flex gap-1 border-b border-ink-800 p-2">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
            tab === t.key ? 'bg-gold-400/15 text-gold-200' : 'text-ink-400 hover:bg-ink-800'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  // Result rows — shared between the desktop dropdown and the mobile overlay.
  const resultsList = (
    <>
      {loading && count === 0 && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-400">
          <Spinner size={16} /> Searching…
        </div>
      )}

      {!loading && count === 0 && (
        <div className="py-8 text-center text-sm text-ink-400">
          No results for “{query.trim()}”.
        </div>
      )}

      {/* People */}
      {show('people') && people.length > 0 && (
        <Section icon={<Users size={13} />} label="People">
          {people.map((p) => (
            <button
              key={p.id}
              onClick={() => messagePerson(p.id)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-ink-800"
            >
              <Avatar src={p.photo} name={p.name} size={36} ring="gold" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink-100">{p.name || 'Member'}</div>
                <div className="truncate text-xs text-ink-400">{p.parish || p.email}</div>
              </div>
              <span className="chip shrink-0 text-gold-200">Message</span>
            </button>
          ))}
        </Section>
      )}

      {/* Churches */}
      {show('churches') && (results.churches?.length ?? 0) > 0 && (
        <Section icon={<Church size={13} />} label="Churches">
          {(results.churches ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setChurch(c);
                setMobileOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-ink-800"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-400/15 text-gold-200">
                <Church size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink-100">{c.name}</div>
                <div className="truncate text-xs text-ink-400">
                  {[c.jurisdiction, c.city, c.region].filter(Boolean).join(' · ')}
                </div>
              </div>
            </button>
          ))}
        </Section>
      )}

      {/* Songs */}
      {show('songs') && (results.songs?.length ?? 0) > 0 && (
        <Section icon={<Music size={13} />} label="Songs & Hymns">
          {(results.songs ?? []).map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setSong(s);
                setMobileOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-ink-800"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-400/15 text-gold-200">
                <Music size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink-100">{s.title}</div>
                <div className="truncate text-xs text-ink-400">
                  {[s.composer, s.tone].filter(Boolean).join(' · ')}
                </div>
              </div>
            </button>
          ))}
        </Section>
      )}

      {/* Videos */}
      {show('videos') && (results.videos?.length ?? 0) > 0 && (
        <Section icon={<Clapperboard size={13} />} label="Videos & Reels">
          {(results.videos ?? []).map((v) => (
            <button
              key={v.id}
              onClick={() => watchVideo(v.id)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-ink-800"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-400/15 text-gold-200">
                <Clapperboard size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink-100">
                  {v.text?.trim() || 'Video post'}
                </div>
                <div className="truncate text-xs text-ink-400">{authorName(v.authorId)}</div>
              </div>
            </button>
          ))}
        </Section>
      )}
    </>
  );

  return (
    <>
      <div ref={containerRef} className={`relative ${className}`}>
        {/* Desktop / tablet: inline search bar (md and up) */}
        <div className="hidden items-center gap-2 rounded-full border border-ink-700 bg-ink-900/80 px-3 py-2 focus-within:border-gold-400/60 md:flex">
          <Search size={16} className="shrink-0 text-ink-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search people, churches, songs, videos…"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink-100 outline-none placeholder:text-ink-500"
            aria-label="Global search"
          />
          {hasQuery && (
            <button onClick={reset} className="shrink-0 text-ink-400 hover:text-ink-100" aria-label="Clear search">
              <X size={15} />
            </button>
          )}
        </div>

        {/* Mobile: collapsed magnifying-glass icon that opens the overlay (below md) */}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-300 hover:bg-ink-800 md:hidden"
          aria-label="Open search"
        >
          <Search size={20} />
        </button>

        {open && hasQuery && (
          <div className="absolute right-0 top-full z-40 mt-2 hidden w-[92vw] max-w-[420px] overflow-hidden rounded-2xl border border-ink-700 bg-ink-900 shadow-card animate-scale-in sm:left-0 sm:right-auto sm:w-[420px] md:block">
            {tabsRow}
            <div className="max-h-[70vh] overflow-y-auto scrollbar-thin p-2">{resultsList}</div>
          </div>
        )}
      </div>

      {/* Mobile: full-screen search overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-ink-950 animate-fade-in md:hidden">
          <div className="flex items-center gap-2 border-b border-ink-800 px-3 py-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-ink-700 bg-ink-900/80 px-3 py-2 focus-within:border-gold-400/60">
              <Search size={18} className="shrink-0 text-ink-400" />
              <input
                ref={mobileInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people, churches, songs, videos…"
                className="min-w-0 flex-1 bg-transparent text-base text-ink-100 outline-none placeholder:text-ink-500"
                aria-label="Global search"
              />
              {hasQuery && (
                <button
                  onClick={() => {
                    setQuery('');
                    setResults(EMPTY_RESULTS);
                    mobileInputRef.current?.focus();
                  }}
                  className="shrink-0 text-ink-400 hover:text-ink-100"
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-ink-300 hover:bg-ink-800"
            >
              Cancel
            </button>
          </div>

          {hasQuery && tabsRow}

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-2">
            {!hasQuery ? (
              <div className="py-12 text-center text-sm text-ink-400">
                Search people, churches, songs and videos.
              </div>
            ) : (
              resultsList
            )}
          </div>
        </div>
      )}

      {/* Church detail */}
      <Modal open={Boolean(church)} onClose={() => setChurch(null)} size="sm">
        {church && (
          <div className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-400/15 text-gold-200">
                <Church size={20} />
              </span>
              <div>
                <h2 className="font-serif text-xl font-semibold text-ink-100">{church.name}</h2>
                <p className="text-xs text-ink-400">
                  {[church.city, church.region].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
            {church.jurisdiction && (
              <div className="mt-4">
                <span className="gold-chip">{church.jurisdiction}</span>
              </div>
            )}
            {church.description && (
              <p className="mt-4 text-sm leading-relaxed text-ink-200">{church.description}</p>
            )}
          </div>
        )}
      </Modal>

      {/* Song detail */}
      <Modal open={Boolean(song)} onClose={() => setSong(null)} size="sm">
        {song && (
          <div className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-400/15 text-gold-200">
                <Music size={20} />
              </span>
              <div>
                <h2 className="font-serif text-xl font-semibold text-ink-100">{song.title}</h2>
                <p className="text-xs text-ink-400">{[song.composer, song.tone].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            {song.lyrics && (
              <p className="mt-4 whitespace-pre-wrap text-sm italic leading-relaxed text-ink-200">
                “{song.lyrics}”
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

function Section({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-500">
        {icon} {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
