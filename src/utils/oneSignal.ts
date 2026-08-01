/**
 * OneSignal Web Push — the notifications that reach a member while the app is
 * closed.
 *
 * The app already subscribes devices to its own VAPID pipeline
 * (`utils/pushNotifications.ts`), which raises alerts through `/sw.js`. That path
 * still works and is untouched; OneSignal is added alongside it so alerts can be
 * sent from the OneSignal dashboard or the `/api/send-push` function without the
 * app having to hold a device list of its own.
 *
 * Everything here is a no-op until `VITE_ONESIGNAL_APP_ID` is set, so a deploy
 * without OneSignal configured behaves exactly as it did before instead of
 * throwing on a missing app id.
 */
const env = import.meta.env as Record<string, string | undefined>;

export const ONESIGNAL_APP_ID = (env.VITE_ONESIGNAL_APP_ID ?? '').trim();

/**
 * OneSignal's worker is registered under its own scope rather than the site root.
 * `/sw.js` already owns scope `/` for offline caching, and a second worker at the
 * same scope would replace it.
 */
const WORKER_PATH = 'OneSignalSDKWorker.js';
const WORKER_SCOPE = '/onesignal/';
const SDK_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

/** Remembers the member the prompt has already been shown for, per browser session. */
const PROMPTED_KEY = 'oc.oneSignalPrompted';

type OneSignalApi = {
  init: (options: Record<string, unknown>) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
  User: {
    PushSubscription: { optIn: () => Promise<void>; optedIn?: boolean };
    addTag: (key: string, value: string) => void;
  };
  Notifications: {
    permission: boolean;
    permissionNative?: NotificationPermission;
    requestPermission: () => Promise<void>;
  };
  Slidedown: { promptPush: (options?: { force?: boolean }) => Promise<void> };
};

declare global {
  interface Window {
    OneSignalDeferred?: ((oneSignal: OneSignalApi) => void | Promise<void>)[];
  }
}

let sdkPromise: Promise<void> | null = null;
let readyPromise: Promise<OneSignalApi | null> | null = null;

export function isOneSignalConfigured(): boolean {
  return Boolean(ONESIGNAL_APP_ID);
}

/** Load the page SDK once. Later calls reuse the same script tag. */
function loadSdk(): Promise<void> {
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.defer = true;
    script.addEventListener('error', () => reject(new Error('The OneSignal SDK could not be loaded.')), { once: true });
    script.addEventListener('load', () => resolve(), { once: true });
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    // A blocked CDN (an ad blocker, an offline device) must not be sticky —
    // clearing the promise lets the next sign-in try again.
    sdkPromise = null;
    throw error;
  });

  return sdkPromise;
}

/**
 * Initialise OneSignal and hand back its API, or `null` when push cannot work
 * here — no app id configured, no service worker support, or the SDK is blocked.
 */
export function initOneSignal(): Promise<OneSignalApi | null> {
  if (readyPromise) return readyPromise;
  if (!isOneSignalConfigured()) return Promise.resolve(null);
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return Promise.resolve(null);
  }

  readyPromise = loadSdk()
    .then(
      () =>
        new Promise<OneSignalApi | null>((resolve) => {
          window.OneSignalDeferred = window.OneSignalDeferred ?? [];
          window.OneSignalDeferred.push(async (oneSignal) => {
            try {
              await oneSignal.init({
                appId: ONESIGNAL_APP_ID,
                serviceWorkerPath: WORKER_PATH,
                serviceWorkerParam: { scope: WORKER_SCOPE },
                // A device that was subscribed before is re-subscribed silently;
                // asking a new one is left to the sign-in prompt below, and the
                // floating bell OneSignal can add of its own is not wanted — the
                // app header already has notification controls.
                autoResubscribe: true,
                notifyButton: { enable: false },
              });
              resolve(oneSignal);
            } catch (error) {
              console.warn('OneSignal could not be initialised.', error);
              resolve(null);
            }
          });
        }),
    )
    .catch((error: unknown) => {
      console.warn('OneSignal push notifications are unavailable.', error);
      readyPromise = null;
      return null;
    });

  return readyPromise;
}

/**
 * Tie this browser's OneSignal subscription to the signed-in member and ask for
 * notification permission.
 *
 * Called when a member signs in. The permission prompt is only raised while the
 * browser has not decided yet: an already-granted permission just needs the
 * subscription refreshed, and a member who said no is not asked again — browsers
 * permanently block a site that re-prompts, and the notification settings in the
 * bell menu remain the way back in.
 */
export async function registerOneSignalMember(userId: string): Promise<void> {
  const oneSignal = await initOneSignal();
  if (!oneSignal || !userId) return;

  try {
    // `login` links every future subscription on this device to the member, which
    // is the `external_id` the send-push function targets.
    await oneSignal.login(userId);
  } catch (error) {
    console.warn('Unable to link this device to your OneSignal profile.', error);
  }

  try {
    if (oneSignal.Notifications.permission) {
      await oneSignal.User.PushSubscription.optIn();
      return;
    }

    const nativePermission = typeof Notification === 'undefined' ? 'default' : Notification.permission;
    if (nativePermission !== 'default') return;
    if (sessionStorage.getItem(`${PROMPTED_KEY}.${userId}`) === '1') return;
    sessionStorage.setItem(`${PROMPTED_KEY}.${userId}`, '1');

    // The slidedown explains why the alert is being asked for before the browser
    // shows its one-shot permission dialog. If the slidedown is unavailable (an
    // older SDK build, a dashboard without it configured) fall back to asking
    // directly rather than skipping the prompt.
    if (typeof oneSignal.Slidedown?.promptPush === 'function') {
      await oneSignal.Slidedown.promptPush();
    } else {
      await oneSignal.Notifications.requestPermission();
    }
    if (oneSignal.Notifications.permission) await oneSignal.User.PushSubscription.optIn();
  } catch (error) {
    console.warn('The notification permission prompt could not be shown.', error);
  }
}

/** Unlink the device on sign-out so alerts stop following the previous member. */
export async function unregisterOneSignalMember(): Promise<void> {
  if (!isOneSignalConfigured() || !readyPromise) return;
  try {
    const oneSignal = await readyPromise;
    await oneSignal?.logout();
  } catch (error) {
    console.warn('Unable to unlink this device from OneSignal.', error);
  }
}
