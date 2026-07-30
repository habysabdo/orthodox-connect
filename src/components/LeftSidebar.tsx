import {
  HeartHandshake,
  LogOut,
  Radio,
  Share2,
  Video,
  X,
  Sun,
  Moon,
  Scroll,
} from 'lucide-react';
import { Avatar, Logo } from './ui';
import { useStore } from '@/store/context';
import { useUI } from '@/store/ui';
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

  const openShare = () => {
    onClose?.();
    setShareOpen(true);
  };

  const getThemeDetails = () => {
    if (theme === 'light') {
      return { label: 'Light Mode', icon: <Sun size={20} />, next: 'Dark Mode' };
    }
    if (theme === 'dark') {
      return { label: 'Dark Mode', icon: <Moon size={20} />, next: 'Ancient View' };
    }
    return { label: 'Ancient View', icon: <Scroll size={20} />, next: 'Light Mode' };
  };

  const activeTheme = getThemeDetails();

  return (
    <aside className="flex h-full min-h-0 w-full flex-col gap-4 overflow-hidden p-4">
      {/* Header */}
      <div className="flex items-center justify-between px-2 pt-1">
        <Logo size={34} withText />
        {onClose && (
          <button onClick={onClose} className="ghost-btn p-2 lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pe-1">
        {/* Quick Broadcast Actions */}
        <button
          onClick={() => {
            onClose?.();
            setGoLiveOpen(true);
          }}
          className="group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-gold-400/40 bg-gradient-to-br from-gold-500/15 to-transparent px-4 py-3 text-left transition-all hover:border-gold-400/70 hover:from-gold-500/25"
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

        <button
          onClick={() => {
            onClose?.();
            setPrayerMeetingOpen(true);
          }}
          className="group flex w-full items-center gap-3 rounded-2xl border border-ink-700 bg-ink-850/60 px-4 py-3 text-left transition-all hover:border-gold-400/50 hover:bg-ink-800"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-800 text-gold-200 group-hover:bg-gold-400/20">
            <Video size={20} />
          </span>
          <div className="flex-1">
            <div className="text-sm font-bold text-ink-100">Start Prayer Meeting</div>
            <div className="text-xs text-ink-400">Pray together over video</div>
          </div>
        </button>

        {/* Menu Utilities (Non-duplicated items) */}
        <nav className="flex flex-col gap-1 pt-2">
          <button
            onClick={() => {
              onClose?.();
              setView('groups');
            }}
            className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
              view === 'groups' || view === 'group'
                ? 'bg-gold-400/15 text-gold-200'
                : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100'
            }`}
          >
            <span className={view === 'groups' || view === 'group' ? 'text-gold-300' : 'text-ink-400 group-hover:text-gold-300'}>
              <HeartHandshake size={20} />
            </span>
            <span className="flex-1 text-left">{t('nav.groups')}</span>
          </button>

          {/* Invite Friends */}
          <button
            onClick={openShare}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-300 transition-all hover:bg-ink-800 hover:text-ink-100"
          >
            <span className="text-ink-400 group-hover:text-gold-300">
              <Share2 size={20} />
            </span>
            <span className="flex-1 text-left">{t('share.invite')}</span>
          </button>

          {/* Language Switcher */}
          <LanguageSwitcher variant="sidebar" />

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-300 transition-all hover:bg-ink-800 hover:text-ink-100"
            aria-label={`Switch to ${activeTheme.next}`}
          >
            <span className="text-ink-400 group-hover:text-gold-300">
              {activeTheme.icon}
            </span>
            <span className="flex-1 text-left">{activeTheme.label}</span>
          </button>
        </nav>
      </div>

      {/* Footer Profile & Sign Out */}
      <div className="shrink-0 space-y-2 pt-2 border-t border-ink-700/60">
        <button
          onClick={() => {
            onClose?.();
            setView('profile');
          }}
          className="flex w-full items-center gap-3 rounded-2xl border border-ink-700 bg-ink-850/60 p-3 text-left transition-colors hover:border-gold-400/40"
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
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-400 transition-colors hover:bg-ink-800 hover:text-red-300"
        >
          <LogOut size={16} />
          {t('common.signOut')}
        </button>
      </div>
    </aside>
  );
}
