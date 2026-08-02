import { StoreProvider, useStore } from './store/StoreProvider';
import { UIProvider } from './store/ui';
import { ThemeProvider } from './store/theme';
import { I18nProvider } from './store/i18n';
import { AuthProvider, useAuth } from './store/auth';
import { ToastProvider } from './components/Toast';
import { Landing } from './components/Landing';
import { Onboarding } from './components/Onboarding';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

function Gate() {
  const { session, profile, loading } = useAuth();
  const { users, currentUserId } = useStore();
  const me = users.find((u) => u.id === currentUserId);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <Loader2 size={32} className="animate-spin text-gold-300" />
      </div>
    );
  }

  if (!session || !profile) {
    return <Landing />;
  }

  if (profile.banned) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-6 text-center">
        <p className="font-serif text-2xl font-semibold text-red-300">Account suspended</p>
        <p className="mt-2 text-sm text-ink-400">Your account has been banned. Please contact your community admin.</p>
      </div>
    );
  }

  if (!profile.onboarded && !me?.onboarded) {
    return <Onboarding />;
  }

  return <AppShell />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <StoreProvider>
              <ToastProvider>
                <UIProvider>
                  <ErrorBoundary>
                    <Gate />
                  </ErrorBoundary>
                </UIProvider>
              </ToastProvider>
            </StoreProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
