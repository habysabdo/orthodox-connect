import type { Notification } from '../types';
import { apiFetch } from '../lib/api';

// Load the signed-in member's notifications, newest first.
export async function loadNotifications(userId: string): Promise<Notification[]> {
  const res = await apiFetch(`/api/notifications?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to load notifications');
  return res.json();
}

// Persist a single notification. Fired when a member likes a post or sends a
// direct message; fire-and-forget from the caller's perspective.
export async function createNotification(notification: Notification): Promise<void> {
  const res = await apiFetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notification),
  });
  if (!res.ok) throw new Error('Failed to create notification');
}

// Mark every unread notification for a member as read ("Mark all as read").
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const res = await apiFetch(`/api/notifications?userId=${encodeURIComponent(userId)}`, {
    method: 'PATCH',
  });
  if (!res.ok) throw new Error('Failed to mark notifications read');
}

// Mark a single notification as read.
export async function markNotificationRead(id: string): Promise<void> {
  const res = await apiFetch(`/api/notifications?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
  });
  if (!res.ok) throw new Error('Failed to mark notification read');
}
