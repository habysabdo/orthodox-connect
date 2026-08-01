import { apiFetch } from '../lib/api';
import { FALLBACK_VAPID_PUBLIC_KEY } from '../config/push';

const DEVICE_ID_KEY = 'oc.pushDeviceId';
const clientEnv = import.meta.env as Record<string, string | undefined>;
const CLIENT_VAPID_PUBLIC_KEY = clientEnv.VITE_VAPID_PUBLIC_KEY?.trim() ||
  clientEnv.VITE_WEB_PUSH_PUBLIC_KEY?.trim() ||
  FALLBACK_VAPID_PUBLIC_KEY;

export type PushStatus = 'unsupported' | 'unavailable' | 'unconfigured' | 'denied' | 'disabled' | 'enabled';

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent || '';
  return /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1);
}

export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function supportsPush(): boolean {
  return typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof ServiceWorkerRegistration !== 'undefined' &&
    'pushManager' in ServiceWorkerRegistration.prototype;
}

function getDeviceId(): string {
  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY);
    if (stored) return stored;
    const deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
    return deviceId;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!supportsPush()) return null;
  try {
    const registration = await ensureServiceWorkerRegistration();
    if (!('pushManager' in registration)) return null;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.warn('Unable to read the push subscription.', error);
    return null;
  }
}

async function ensureServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (!supportsPush()) throw new Error('Push notifications are not supported.');
  try {
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (existing) return existing;
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return await navigator.serviceWorker.ready;
  } catch (error) {
    console.warn('Unable to prepare the service worker for push.', error);
    throw error;
  }
}

export async function getPushStatus(): Promise<PushStatus> {
  if (isIosDevice() && !isStandaloneApp()) return 'unavailable';
  if (!supportsPush()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'disabled';
  try {
    return (await currentSubscription()) ? 'enabled' : 'disabled';
  } catch {
    return 'unsupported';
  }
}

export async function enablePushNotifications(): Promise<PushStatus> {
  if (isIosDevice() && !isStandaloneApp()) return 'unavailable';
  if (!supportsPush()) return 'unsupported';

  try {
    const keyResponse = await apiFetch('/api/push-subscriptions');
    if (!keyResponse.ok) throw new Error('Unable to load push notification settings.');
    const { publicKey = CLIENT_VAPID_PUBLIC_KEY, configured } = await keyResponse.json() as {
      publicKey?: string;
      configured?: boolean;
    };
    if (!configured) {
      console.warn('Push notification setup is not complete; subscription was skipped.');
      return 'unconfigured';
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'disabled';

    const registration = await ensureServiceWorkerRegistration();
    if (!('pushManager' in registration)) return 'unsupported';
    const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    const serialized = subscription.toJSON();
    const response = await apiFetch('/api/push-subscriptions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        ...serialized,
      }),
    });
    if (!response.ok) throw new Error('Unable to save this device for push notifications.');
    return 'enabled';
  } catch (error) {
    console.warn('Push notifications could not be enabled.', error);
    return 'disabled';
  }
}

export async function updatePushPresence(activeThreadId: string | null): Promise<void> {
  if (!supportsPush() || Notification.permission !== 'granted') return;
  try {
    const subscription = await currentSubscription();
    if (!subscription) return;
    await apiFetch('/api/push-subscriptions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        activeThreadId,
        visible: document.visibilityState === 'visible',
      }),
    });
  } catch (error) {
    console.warn('Unable to update push notification presence.', error);
  }
}
