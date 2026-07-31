import webPush from 'web-push';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { pushSubscriptions } from '../../db/schema.js';
import { FALLBACK_VAPID_PUBLIC_KEY } from '../../src/config/push.js';
import type { ChatMessage, Notification } from '../../src/types.js';

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

function getConfiguredPublicVapidKey(): string {
  return env('WEB_PUSH_VAPID_PUBLIC_KEY') ||
    env('VAPID_PUBLIC_KEY') ||
    env('VITE_VAPID_PUBLIC_KEY') ||
    env('VITE_WEB_PUSH_PUBLIC_KEY');
}

function getPrivateVapidKey(): string {
  return env('WEB_PUSH_PRIVATE_KEY');
}

export function getPublicVapidKey(): string {
  return getConfiguredPublicVapidKey() || FALLBACK_VAPID_PUBLIC_KEY;
}

export function isWebPushConfigured(): boolean {
  return Boolean(getPublicVapidKey() && getPrivateVapidKey());
}

function configureWebPush(): boolean {
  const publicKey = getPublicVapidKey();
  const privateKey = getPrivateVapidKey();
  if (!publicKey || !privateKey) return false;
  webPush.setVapidDetails(
    env('WEB_PUSH_VAPID_SUBJECT') || env('VAPID_SUBJECT') || 'mailto:support@orthodoxconnect.live',
    publicKey,
    privateKey,
  );
  return true;
}

function messagePreview(message: ChatMessage): string {
  const text = message.text.trim();
  if (text) return text.length > 120 ? `${text.slice(0, 117)}…` : text;
  const attachment = message.attachments?.[0];
  if (!attachment) return 'Sent you a message';
  if (attachment.kind === 'image') return 'Sent you a photo';
  if (attachment.kind === 'audio') return 'Sent you a voice message';
  return attachment.name ? `Sent ${attachment.name}` : 'Sent you an attachment';
}

async function sendPushPayload(recipientId: string, payload: string): Promise<void> {
  if (!configureWebPush()) {
    console.warn('Web push skipped because VAPID environment variables are not configured');
    return;
  }

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, recipientId));
  if (!subscriptions.length) return;

  await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload,
          { TTL: 300, urgency: 'high' },
        );
      } catch (error) {
        const statusCode = typeof error === 'object' && error && 'statusCode' in error
          ? Number(error.statusCode)
          : 0;
        if (statusCode === 404 || statusCode === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id));
          return;
        }
        console.error('Unable to send web push notification', { statusCode });
      }
    }),
  );
}

export async function sendDirectMessagePush(input: {
  recipientId: string;
  senderName: string;
  message: ChatMessage;
}): Promise<void> {
  const chatUrl = `https://orthodoxconnect.live/chat/${encodeURIComponent(input.message.threadId)}`;
  const payload = JSON.stringify({
    title: input.senderName,
    body: messagePreview(input.message),
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `direct-message-${input.message.threadId}`,
    url: chatUrl,
    data: {
      type: 'direct-message',
      threadId: input.message.threadId,
      messageId: input.message.id,
      url: chatUrl,
    },
  });

  await sendPushPayload(input.recipientId, payload);
}

export async function sendNotificationPush(notification: Notification): Promise<void> {
  const isMessage = notification.type === 'message';
  const destination = isMessage && notification.threadId
    ? `/chat/${encodeURIComponent(notification.threadId)}`
    : notification.postId
      ? `/post/${encodeURIComponent(notification.postId)}`
      : '/';
  const url = `https://orthodoxconnect.live${destination}`;
  const payload = JSON.stringify({
    title: notification.actorName || 'OrthodoxConnect',
    body: notification.content || 'You have a new notification.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: isMessage && notification.threadId
      ? `direct-message-${notification.threadId}`
      : `notification-${notification.id}`,
    url,
    data: {
      type: notification.type,
      notificationId: notification.id,
      actorId: notification.actorId,
      postId: notification.postId ?? null,
      threadId: notification.threadId ?? null,
      url,
    },
  });

  await sendPushPayload(notification.userId, payload);
}
