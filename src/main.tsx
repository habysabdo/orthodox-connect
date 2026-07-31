import './polyfills';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './theme-context';
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

// Register the service worker for offline caching and PWA installability.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    try {
      void navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('Service worker registration was skipped.', error);
      });
    } catch (error) {
      console.warn('Service workers are unavailable in this browser.', error);
    }
  });
}
