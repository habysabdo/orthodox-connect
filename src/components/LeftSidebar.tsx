import {
  CalendarDays,
  Clapperboard,
  Compass,
  Home,
  LogOut,
  Radio,
  Shield,
  Sun,
  MessageCircle,
  Moon,
  UserCircle,
  Share2,
  Video,
  X,
} from 'lucide-react';
import { Avatar, Logo } from './ui';
import { useStore, unreadCountFor } from '@/store/context';
import { useUI, type ViewKey } from '@/store/ui';
import { useI18n } from '@/i18n';
import { hasAdminAccess } from '@/utils/users';
import { userName } from '@/utils/postSafety';
import { useTheme } from '@/theme-context';
import { LanguageSwitcher } from './LanguageSwitcher';

export function LeftSidebar({ onClose }: { onClose?: () => void }) {
  const state = useStore();
  const { users, currentUserId, signOut } = state;
  const { view, setView, setGoLiveOpen, setShareOpen, setPrayerMeetingOpen } = useUI();
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const me = users.find((u) => u?.id === currentUserId);
  if (!me) return null;

  const unread = unreadCountFor(state, me.id);
  const openShare = () => {
    onClose?.();
    setShareOpen(true);
  };

  const nav: { key: ViewKey; label: string; icon: React.ReactNode; badge?: number; href?: string }[] = [
    { key: 'feed', label: t('nav.feed'), icon: <Home size={20} /> },
    { key: 'reels', label: t('nav.reels'), icon: <Clapperboard size={20} /> },
    { key: 'messenger', label: t('nav.messages'), icon: <MessageCircle size={20} />, badge: unread || undefined },
    { key: 'calendar', label: t('nav.calendar'), icon: <CalendarDays size={20} /> },
    { key: 'groups', label: t('nav.groups'), icon: <Compass size={20} /> },
    { key: 'profile', label: t('nav.profile'), icon: <UserCircle size={20} /> },
    ...(hasAdminAccess(me)
      ? [{ key: 'admin' as ViewKey, label: t('nav.admin'), icon: <Shield size={20} />, href: '/admin' }]
      : []),
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
          <div className="text-sm font-bold text-gold-100">{t('header.goLive')}</div>
          <div className="text-xs text-ink-400">{t('header.broadcast')}</div>
        </div>
        <span className="flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-red-500/70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
        </span>
      </button>

      {/* Prayer meeting CTA */}
      <button
        onClick={() => {
          onClose?.();
          setPrayerMeetingOpen(true);
        }}
        className="group flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-850/60 px-4 py-3 text-left transition-all hover:border-gold-400/50 hover:bg-ink-800"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-800 text-gold-200 group-hover:bg-gold-400/20">
          <Video size={20} />
        </span>
        <div className="flex-1">
          <div className="text-sm font-bold text-ink-100">Start Prayer Meeting</div>
          <div className="text-xs text-ink-400">Pray together over video</div>
        </div>
      </button>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {nav.map((item) => {
          const active = view === item.key;
          const className = `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
            active
              ? 'bg-gold-400/10 text-gold-200 shadow-[inset_0_0_0_1px_rgba(212,175,55,0.3)]'
              : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
          }`;
          const content = (
            <>
              <span className={active ? 'text-gold-300' : 'text-ink-400 group-hover:text-gold-300'}>
                {item.icon}
              </span>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-gold-400 px-1.5 text-[11px] font-bold text-[#17130a]">
                  {item.badge}
                </span>
              ) : null}
              {active && <span className="h-1.5 w-1.5 rounded-full bg-gold-300" />}
            </>
          );

          if (item.href) {
            return (
              <a
                key={item.key}
                href={item.href}
                onClick={(event) => {
                  event.preventDefault();
                  setView(item.key);
                  onClose?.();
                }}
                className={className}
              >
                {content}
              </a>
            );
          }

          return (
            <button
              key={item.key}
              onClick={() => {
                setView(item.key);
                onClose?.();
              }}
              className={className}
            >
              {content}
            </button>
          );
        })}

        {/* Invite / share */}
        <button
          onClick={openShare}
          className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-300 transition-all hover:bg-ink-800 hover:text-ink-100"
        >
          <span className="text-ink-400 group-hover:text-gold-300">
            <Share2 size={20} />
          </span>
          <span className="flex-1 text-left">{t('share.invite')}</span>
        </button>

        <LanguageSwitcher variant="sidebar" />

        <button
          type="button"
          onClick={toggleTheme}
          className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-300 transition-all hover:bg-ink-800 hover:text-ink-100"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <span className="text-ink-400 group-hover:text-gold-300">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </span>
          <span className="flex-1 text-left">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

      </nav>

      <div className="flex-1" />

      {/* Me card */}
      <button
        onClick={() => setView('profile')}
        className="flex items-center gap-3 rounded-2xl border border-ink-700 bg-ink-850/60 p-3 text-left transition-colors hover:border-gold-400/40"
      >
        <Avatar src={me.photo} name={me.name} size={40} online ring="gold" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink-100">{userName(me)}</div>
          <div className="truncate text-xs text-ink-400">{me.parish || t('profile.noParish')}</div>
        </div>
        {hasAdminAccess(me) && <span className="gold-chip">{t('common.admin')}</span>}
      </button>

      <button
        onClick={signOut}
        className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-400 transition-colors hover:bg-ink-800 hover:text-red-300"
      >
        <LogOut size={16} />
        {t('common.signOut')}
      </button>
    </aside>
  );
}
