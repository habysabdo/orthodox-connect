import type { AdminNotification } from '../types';
import { apiFetch } from '../lib/api';

export interface AdminNotificationFeed {
  notifications: AdminNotification[];
  unreadCount: number;
}

// Load the shared admin alert feed (recent alerts plus the full unread total).
// The endpoint is admin-only, so a non-admin caller gets a 403 and this throws.
export async function loadAdminNotifications(): Promise<AdminNotificationFeed> {
  const res = await apiFetch('/api/admin-notifications', {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to load admin notifications');
  return res.json();
}

// Clear every unread admin alert ("Mark all as read"). Alerts are shared, so
// this clears the badge for every administrator.
export async function markAllAdminNotificationsRead(): Promise<void> {
  const res = await apiFetch('/api/admin-notifications', {
    method: 'PATCH',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to mark admin notifications read');
}
