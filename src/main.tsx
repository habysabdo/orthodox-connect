import './polyfills';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './theme.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { resetAutomaticReloadGuard } from './utils/appRecovery';

const originalRemoveChild = Node.prototype.removeChild;
const originalInsertBefore = Node.prototype.insertBefore;

Node.prototype.removeChild = function <T extends Node>(child: T): T {
  try {
    return originalRemoveChild.call(this, child) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return child;
    }

    throw error;
  }
};

Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
  try {
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return this.appendChild(newNode) as T;
    }

    throw error;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary monitorGlobalErrors>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>
);

resetAutomaticReloadGuard();

// Automatically unregister service workers and purge caches to prevent stale asset hashes
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

if ('caches' in window) {
  caches.keys().then((names) => {
    for (const name of names) {
      caches.delete(name);
    }
  });
}