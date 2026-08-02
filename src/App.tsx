import { StoreProvider, useStore } from './store/StoreProvider';
import { UIProvider } from './store/ui';
import { Landing } from './components/Landing';
import { Onboarding } from './components/Onboarding';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';

function Gate() {
  const { users, currentUserId } = useStore();
  const me = users.find((u) => u.id === currentUserId);

  if (!me) {
    console.log('[Gate] No current user → Landing');
    return <Landing />;
  }
  if (!me.onboarded) {
    console.log('[Gate] User not onboarded → Onboarding', me.email);
    return <Onboarding />;
  }
  console.log('[Gate] User ready → AppShell', me.email);
  return <AppShell />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <UIProvider>
          <ErrorBoundary>
            <Gate />
          </ErrorBoundary>
        </UIProvider>
      </StoreProvider>
    </ErrorBoundary>
  );
}
