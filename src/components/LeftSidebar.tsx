import {
  CalendarDays,
  Clapperboard,
  Home,
  LogOut,
  Moon,
  Radio,
  Shield,
  Sun,
  Users,
  MessageCircle,
  UserCircle,
  Upload,
  X,
  Scroll,
  Languages,
} from 'lucide-react';
import { Avatar, Logo } from './ui';
import { useStore, unreadCountFor } from '@/store/context';
import { useUI, type ViewKey } from '@/store/ui';
import { useTheme, type ThemeMode } from '@/store/theme';
import { useI18n, type Lang } from '@/store/i18n';
import { useAuth } from '@/store/auth';

export function LeftSidebar({ onClose }: { onClose?: () => void }) {
  const state = useStore();
  const { users, currentUserId } = state;
  const { view, setView, setGoLiveOpen, setUploadOpen } = useUI();
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
  const { profile, signOut } = useAuth();
  const me = users.find((u) => u.id === currentUserId);
  if (!me) return null;
  const isAdmin = profile?.role === 'admin';

  const unread = unreadCountFor(state, me.id);

  const nav: { key: ViewKey; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: 'feed', label: t('nav.feed'), icon: <Home size={20} /> },
    { key: 'reels', label: t('nav.reels'), icon: <Clapperboard size={20} /> },
    { key: 'network', label: t('nav.network'), icon: <Users size={20} /> },
    { key: 'messenger', label: t('nav.messages'), icon: <MessageCircle size={20} />, badge: unread || undefined },
    { key: 'calendar', label: t('nav.calendar'), icon: <CalendarDays size={20} /> },
    { key: 'profile', label: t('nav.profile'), icon: <UserCircle size={20} /> },
    ...(isAdmin
      ? [{ key: 'admin' as ViewKey, label: t('nav.admin'), icon: <Shield size={20} /> }]
      : []),
  ];

  const themeOptions: { mode: ThemeMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'dark', icon: <Moon size={14} />, label: t('nav.dark') },
    { mode: 'light', icon: <Sun size={14} />, label: t('nav.light') },
    { mode: 'ancient', icon: <Scroll size={14} />, label: t('nav.ancient') },
  ];

  const langOptions: { code: Lang; label: string }[] = [
    { code: 'en', label: 'EN' },
    { code: 'ar', label: 'العربية' },
  ];

  return (
    <aside className="flex h-full w-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between px-2 pt-1">
        <Logo size={34} withText />
        {onClose && (
          <button onClick={onClose} className="ghost-btn p-2 lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Go Live CTA */}
      <button
        onClick={() => setGoLiveOpen(true)}
        className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-gold-400/40 bg-gradient-to-br from-gold-500/15 to-transparent px-4 py-3 text-left transition-all hover:border-gold-400/70 hover:from-gold-500/25"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-400/20 text-gold-200 group-hover:bg-gold-400/30">
          <Radio size={20} />
        </span>
        <div className="flex-1">
          <div className="text-sm font-bold text-gold-100">{t('nav.goLive')}</div>
          <div className="text-xs text-ink-400">{t('nav.broadcast')}</div>
        </div>
        <span className="flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-red-500/70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
      </button>

      {/* Upload CTA */}
      <button
        onClick={() => setUploadOpen(true)}
        className="flex items-center gap-3 rounded-2xl border border-ink-600 bg-ink-800/60 px-4 py-3 text-left transition-all hover:border-gold-400/40 hover:bg-ink-750"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-maroon-600/20 text-maroon-400">
          <Upload size={20} />
        </span>
        <div className="flex-1">
          <div className="text-sm font-bold text-ink-100">{t('nav.upload')}</div>
          <div className="text-xs text-ink-400">{t('nav.share')}</div>
        </div>
      </button>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {nav.map((item) => {
          const active = view === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                active
                  ? 'bg-gold-400/10 text-gold-200 shadow-[inset_0_0_0_1px_rgba(212,175,55,0.3)]'
                  : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
              }`}
            >
              <span className={active ? 'text-gold-300' : 'text-ink-400 group-hover:text-gold-300'}>
                {item.icon}
              </span>
              <span className="flex-1 text-left rtl-text-right">{item.label}</span>
              {item.badge ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1.5 text-[11px] font-bold text-ink-950">
                  {item.badge}
                </span>
              ) : null}
              {active && <span className="h-1.5 w-1.5 rounded-full bg-gold-300" />}
            </button>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Language switcher */}
      <div className="rounded-2xl border border-ink-700 bg-ink-850/60 p-2">
        <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">
          <Languages size={12} /> {t('nav.language')}
        </div>
        <div className="flex gap-1">
          {langOptions.map((opt) => (
            <button
              key={opt.code}
              onClick={() => setLang(opt.code)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-all ${
                lang === opt.code
                  ? 'bg-gold-400/15 text-gold-200 shadow-[inset_0_0_0_1px_rgba(212,175,55,0.3)]'
                  : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Theme toggle */}
      <div className="rounded-2xl border border-ink-700 bg-ink-850/60 p-2">
        <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">{t('nav.theme')}</div>
        <div className="flex gap-1">
          {themeOptions.map((opt) => (
            <button
              key={opt.mode}
              onClick={() => setTheme(opt.mode)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-all ${
                theme === opt.mode
                  ? 'bg-gold-400/15 text-gold-200 shadow-[inset_0_0_0_1px_rgba(212,175,55,0.3)]'
                  : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200'
              }`}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Me card */}
      <button
        onClick={() => setView('profile')}
        className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-850/60 p-3 text-left transition-colors hover:border-gold-400/40"
      >
        <Avatar src={me.photo} name={me.name} size={40} online ring="gold" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 truncate text-sm font-semibold text-ink-100">
            {me.name}
            {me.verified && (
              <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0 text-gold-400" fill="currentColor">
                <path d="M9.5 12l2 2 4-4.5" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div className="truncate text-xs text-ink-400">{me.parish || t('nav.noParish')}</div>
        </div>
        {isAdmin && <span className="gold-chip">Admin</span>}
      </button>

      <button
        onClick={signOut}
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-400 transition-colors hover:bg-ink-800 hover:text-red-300"
      >
        <LogOut size={16} className="rtl-flip" />
        {t('nav.signOut')}
      </button>
    </aside>
  );
}
