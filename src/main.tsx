import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './store/theme';
import { ErrorBoundary } from './components/ErrorBoundary';

const rootEl = document.getElementById('root');

if (!rootEl) {
  document.body.innerHTML =
    '<div style="display:flex;min-height:100vh;align-items:center;justify-content:center;font-family:sans-serif;color:#d4af37;background:#0a0c12">OrthodoxConnect could not find its root element. Please reload.</div>';
} else {
  try {
    createRoot(rootEl).render(
      <StrictMode>
        <ErrorBoundary>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </ErrorBoundary>
      </StrictMode>,
    );
  } catch (err) {
    console.error('[mount] Fatal render error:', err);
    rootEl.innerHTML =
      '<div style="display:flex;min-height:100vh;flex-direction:column;align-items:center;justify-content:center;gap:12px;font-family:sans-serif;color:#d4af37;background:#0a0c12;text-align:center;padding:24px"><h1 style="font-size:20px;margin:0">Something went wrong</h1><p style="color:#94a3b8;margin:0">The app failed to start. Please reload the page.</p><button onclick="window.location.reload()" style="margin-top:8px;padding:8px 20px;border:1px solid #d4af37;background:transparent;color:#d4af37;border-radius:8px;cursor:pointer">Reload</button></div>';
  }
}
