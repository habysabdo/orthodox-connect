import { lazy, Suspense } from 'react';
import { StoreProvider, useStore } from './store/StoreProvider';
import { UIProvider } from './store/ui';
import { NotificationsProvider } from './store/notifications';
import { I18nProvider } from './i18n';
import { LoadingScreen } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';

const Landing = lazy(() => import('./components/Landing').then((module) => ({ default: module.Landing })));
const AppShell = lazy(() => import('./components/AppShell').then((module) => ({ default: module.AppShell })));
const IncomingCallOverlay = lazy(() =>
  import('./components/IncomingCallOverlay').then((module) => ({ default: module.IncomingCallOverlay })),
);

function Gate() {
  const { users, currentUserId, authChecked } = useStore();

  // Wait for the persisted authentication session to be restored before deciding what
  // to render. Without this, the gate would fall through to <Landing /> on the
  // first paint and flash the login page to already-signed-in users — the bug
  // this addresses, most visible on mobile where session restore is slower.
  if (!authChecked) {
    return <LoadingScreen label="Signing you in…" />;
  }

  const safeUsers = Array.isArray(users) ? users : [];
  const me = currentUserId ? safeUsers.find((user) => user?.id === currentUserId) : undefined;

  if (!me) {
    console.log('[Gate] No current user → Landing');
    return (
      <ErrorBoundary name="Sign in" variant="section" resetKeys={[currentUserId]}>
        <Suspense fallback={<LoadingScreen label="Loading sign in…" />}>
          <Landing />
        </Suspense>
      </ErrorBoundary>
    );
  }
  console.log('[Gate] User ready → AppShell', me.email);
  return (
    <>
      <ErrorBoundary name="Community" resetKeys={[currentUserId]}>
        <Suspense fallback={<LoadingScreen label="Loading your community…" />}>
          <AppShell />
        </Suspense>
      </ErrorBoundary>
      {/* Calls have to reach the member wherever they are, including inside a
          prayer room, so the listener lives above every view. */}
      <ErrorBoundary name="Incoming call" fallback={null} resetKeys={[currentUserId]}>
        <Suspense fallback={null}>
          <IncomingCallOverlay />
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <StoreProvider>
        <UIProvider>
          <NotificationsProvider>
            <Gate />
          </NotificationsProvider>
        </UIProvider>
      </StoreProvider>
    </I18nProvider>
  );
}
