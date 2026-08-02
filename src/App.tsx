import { StoreProvider, useStore } from './store/StoreProvider';
import { UIProvider } from './store/ui';
import { ThemeProvider } from './store/theme';
import { I18nProvider } from './store/i18n';
import { Landing } from './components/Landing';
import { Onboarding } from './components/Onboarding';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';

function Gate() {
  const { users, currentUserId } = useStore();
  const me = users.find((u) => u.id === currentUserId);

  if (!me) {
    return <Landing />;
  }
  if (!me.onboarded) {
    return <Onboarding />;
  }
  return <AppShell />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <I18nProvider>
          <StoreProvider>
            <UIProvider>
              <ErrorBoundary>
                <Gate />
              </ErrorBoundary>
            </UIProvider>
          </StoreProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
