import type { Notification } from '../types';
import { supabase } from '../lib/supabase';

// Load the signed-in member's notifications, newest first.
export async function loadNotifications(userId: string): Promise<Notification[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load notifications from Supabase:', error);
      return [];
    }

    return (data as Notification[]) || [];
  } catch (err) {
    console.error('Error in loadNotifications:', err);
    return [];
  }
}

// Persist a single notification.
export async function createNotification(notification: Notification): Promise<void> {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert([notification]);

    if (error) {
      console.error('Failed to create notification in Supabase:', error);
    }
  } catch (err) {
    console.error('Error in createNotification:', err);
  }
}

// Mark every unread notification for a member as read ("Mark all as read").
export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!userId) return;

  try {
    const { error } = await supabase
      .from('notifications')
      .update({ isRead: true })
      .eq('user_id', userId)
      .eq('isRead', false);

    if (error) {
      console.error('Failed to mark all notifications read in Supabase:', error);
    }
  } catch (err) {
    console.error('Error in markAllNotificationsRead:', err);
  }
}

// Mark a single notification as read.
export async function markNotificationRead(id: string): Promise<void> {
  if (!id) return;

  try {
    const { error } = await supabase
      .from('notifications')
      .update({ isRead: true })
      .eq('id', id);

    if (error) {
      console.error('Failed to mark notification read in Supabase:', error);
    }
  } catch (err) {
    console.error('Error in markNotificationRead:', err);
  }
}