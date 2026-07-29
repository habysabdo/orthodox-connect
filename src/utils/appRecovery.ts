const AUTOMATIC_RELOAD_KEY = 'oc-stale-chunk-reload';
const AUTOMATIC_RELOAD_WINDOW_MS = 30_000;

const STALE_CHUNK_PATTERNS = [
  /Loading chunk(?: [\d]+)? failed/i,
  /ChunkLoadError/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /Unable to preload CSS/i,
];

function getErrorMessage(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;

  if (value && typeof value === 'object') {
    const candidate = value as { name?: unknown; message?: unknown };
    return [candidate.name, candidate.message]
      .filter((part): part is string => typeof part === 'string')
      .join(': ');
  }

  return '';
}

export function isStaleChunkError(value: unknown): boolean {
  const message = getErrorMessage(value);
  return STALE_CHUNK_PATTERNS.some((pattern) => pattern.test(message));
}

export function isFailedAssetLoad(event: ErrorEvent): boolean {
  const target = event.target;
  if (target instanceof HTMLScriptElement) return target.src.includes('/assets/');
  if (target instanceof HTMLLinkElement) return target.href.includes('/assets/');
  return false;
}

async function unregisterServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch (error) {
    console.warn('Unable to unregister stale service workers.', error);
  }
}

async function clearCacheStorage(): Promise<void> {
  if (!('caches' in window)) return;

  try {
    const cacheNames = await window.caches.keys();
    await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
  } catch (error) {
    console.warn('Unable to clear stale browser caches.', error);
  }
}

export async function cleanReload(): Promise<void> {
  await Promise.all([unregisterServiceWorkers(), clearCacheStorage()]);
  window.location.reload();
}

function claimAutomaticReload(): boolean {
  try {
    const previousReload = Number(window.sessionStorage.getItem(AUTOMATIC_RELOAD_KEY) || 0);
    if (Date.now() - previousReload < AUTOMATIC_RELOAD_WINDOW_MS) return false;
    window.sessionStorage.setItem(AUTOMATIC_RELOAD_KEY, String(Date.now()));
  } catch {
    // Recovery still works when session storage is unavailable.
  }

  return true;
}

export async function recoverFromStaleChunk(value: unknown): Promise<boolean> {
  if (!isStaleChunkError(value) || !claimAutomaticReload()) return false;

  await cleanReload();
  return true;
}

export function resetAutomaticReloadGuard(): void {
  window.setTimeout(() => {
    try {
      window.sessionStorage.removeItem(AUTOMATIC_RELOAD_KEY);
    } catch {
      // Nothing to reset when session storage is unavailable.
    }
  }, AUTOMATIC_RELOAD_WINDOW_MS);
}
