import { useEffect, useRef, useState } from 'react';
import { Search, Sparkles, X } from 'lucide-react';
import { searchFaithGifs, type FaithGif } from '@/utils/gifs';

interface GifPickerProps {
  onClose: () => void;
  onSelect: (gif: FaithGif) => void;
}

export function GifPicker({ onClose, onSelect }: GifPickerProps) {
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<FaithGif[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError('');
      searchFaithGifs(query, controller.signal)
        .then(setGifs)
        .catch((searchError) => {
          if (searchError instanceof DOMException && searchError.name === 'AbortError') return;
          setGifs([]);
          setError(searchError instanceof Error ? searchError.message : 'Unable to load faith GIFs.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, query ? 350 : 0);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/75 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="faith-gif-title"
        className="flex max-h-[82vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-ink-700 bg-ink-900 shadow-2xl sm:rounded-3xl"
      >
        <div className="border-b border-ink-700 bg-gradient-to-r from-gold-400/10 via-transparent to-emerald-400/10 px-4 pb-4 pt-4 sm:px-5">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2 text-gold-300">
                <Sparkles size={17} />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Faith-focused only</span>
              </div>
              <h2 id="faith-gif-title" className="text-lg font-bold text-ink-50">Choose a Christian GIF</h2>
              <p className="mt-1 text-xs text-ink-400">Every search is filtered through Orthodox Christian faith terms.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-ink-700 bg-ink-800 p-2 text-ink-300 transition hover:border-gold-400/50 hover:text-gold-200"
              aria-label="Close GIF picker"
            >
              <X size={18} />
            </button>
          </div>

          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" size={17} />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search joy, prayer, encouragement…"
              className="input pl-10 pr-4"
              maxLength={80}
              aria-label="Search Christian GIFs"
            />
          </label>
        </div>

        <div className="min-h-72 flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Loading GIFs">
              {Array.from({ length: 9 }, (_, index) => (
                <div key={index} className="aspect-square animate-pulse rounded-xl bg-ink-800" />
              ))}
            </div>
          ) : error ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 rounded-full bg-gold-400/10 p-3 text-gold-300"><Sparkles size={24} /></div>
              <p role="alert" className="max-w-sm text-sm font-medium text-ink-200">{error}</p>
            </div>
          ) : gifs.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <p className="text-sm font-semibold text-ink-200">No faith-focused GIFs found</p>
              <p className="mt-1 text-xs text-ink-400">Try a word like prayer, blessing, joy, or worship.</p>
            </div>
          ) : (
            <div className="columns-2 gap-2 sm:columns-3">
              {gifs.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => onSelect(gif)}
                  className="group relative mb-2 block w-full break-inside-avoid overflow-hidden rounded-xl border border-ink-700 bg-ink-800 text-left transition hover:-translate-y-0.5 hover:border-gold-400/70 hover:shadow-glow focus:outline-none focus:ring-2 focus:ring-gold-400"
                  aria-label={`Attach ${gif.title}`}
                >
                  <img
                    src={gif.url}
                    alt={gif.title}
                    loading="lazy"
                    className="h-auto w-full object-cover"
                    width={gif.width}
                    height={gif.height}
                    referrerPolicy="no-referrer"
                  />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/80 to-transparent px-2 pb-2 pt-6 text-[10px] font-bold uppercase tracking-wider text-white transition-transform group-hover:translate-y-0">
                    Add GIF
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-ink-700 bg-ink-950/70 px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
          Powered by GIPHY
        </div>
      </section>
    </div>
  );
}
