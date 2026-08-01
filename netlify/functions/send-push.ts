import type { Config } from '@netlify/functions';
import { isResponse, requireAdmin } from './_auth.js';

/**
 * Sends a Web Push alert through OneSignal's REST API.
 *
 * This is the path that reaches a member while OrthodoxConnect is closed:
 * OneSignal holds the device subscriptions (registered by the browser through
 * `public/OneSignalSDKWorker.js`) and delivers the message to the operating
 * system, so nothing needs to be running in the browser for the alert to arrive.
 *
 * The credentials never leave the function. `ONESIGNAL_REST_API_KEY` grants the
 * ability to notify every subscriber of the app, so the endpoint is limited to
 * admins and the key is only ever read from the environment here.
 */
const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';
const DEFAULT_SEGMENT = 'Subscribed Users';

interface SendPushInput {
  /** app user ids to notify — the `external_id` each browser is logged in with */
  externalIds?: string[];
  /** OneSignal segments to notify instead; defaults to every subscriber */
  segments?: string[];
  title?: string;
  message?: string;
  /** where tapping the alert should open the app */
  url?: string;
  /** grouping key, so a second alert about the same thing replaces the first */
  tag?: string;
  data?: Record<string, unknown>;
}

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

export function isOneSignalConfigured(): boolean {
  return Boolean(env('ONESIGNAL_APP_ID') && env('ONESIGNAL_REST_API_KEY'));
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
}

/**
 * Deliver one notification. Returns the ids OneSignal assigned, or throws with a
 * caller-safe message — the response body is logged rather than returned so a
 * credential problem is never echoed to the browser.
 *
 * Exported so server-side flows (a new post, a prayer request, an admin
 * announcement) can raise an alert without going back through HTTP.
 */
export async function sendOneSignalNotification(input: SendPushInput): Promise<string[]> {
  const appId = env('ONESIGNAL_APP_ID');
  const restApiKey = env('ONESIGNAL_REST_API_KEY');
  if (!appId || !restApiKey) {
    throw new Error('OneSignal is not configured for this site.');
  }

  const message = input.message?.trim();
  if (!message) throw new Error('A notification message is required.');

  const externalIds = stringList(input.externalIds);
  const segments = stringList(input.segments);

  const payload: Record<string, unknown> = {
    app_id: appId,
    target_channel: 'push',
    contents: { en: message },
    headings: { en: input.title?.trim() || 'OrthodoxConnect' },
    chrome_web_icon: 'https://orthodoxconnect.live/icon-192.png',
    chrome_web_badge: 'https://orthodoxconnect.live/icon-192.png',
  };

  // `include_aliases` addresses named members; a segment is the broadcast case.
  if (externalIds.length) {
    payload.include_aliases = { external_id: externalIds };
  } else {
    payload.included_segments = segments.length ? segments : [DEFAULT_SEGMENT];
  }

  if (input.url?.trim()) payload.url = input.url.trim();
  if (input.tag?.trim()) payload.web_push_topic = input.tag.trim();
  if (input.data) payload.data = input.data;

  const response = await fetch(ONESIGNAL_API_URL, {
    method: 'POST',
    headers: {
      // OneSignal accepts the REST key as HTTP Basic credentials on the v1 API.
      Authorization: `Basic ${restApiKey}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => ({}))) as {
    id?: string;
    recipients?: number;
    errors?: unknown;
  };

  if (!response.ok || result.errors) {
    console.error('OneSignal rejected the notification', { status: response.status, errors: result.errors });
    throw new Error('The notification could not be sent.');
  }

  return result.id ? [result.id] : [];
}

export default async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const actor = await requireAdmin(req);
  if (isResponse(actor)) return actor;

  if (!isOneSignalConfigured()) {
    return Response.json(
      { error: 'Push notifications are not configured for this site yet.' },
      { status: 503 },
    );
  }

  let body: SendPushInput;
  try {
    body = (await req.json()) as SendPushInput;
  } catch {
    return Response.json({ error: 'A JSON body is required' }, { status: 400 });
  }

  if (!body.message?.trim()) {
    return Response.json({ error: 'message is required' }, { status: 400 });
  }

  try {
    const ids = await sendOneSignalNotification(body);
    return Response.json({ ok: true, notificationIds: ids });
  } catch (error) {
    console.error('Unable to send the push notification', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'The notification could not be sent.' },
      { status: 502 },
    );
  }
};

export const config: Config = {
  path: '/api/send-push',
  method: ['POST'],
};
