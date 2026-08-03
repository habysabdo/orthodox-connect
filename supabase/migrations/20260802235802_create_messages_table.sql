/*
# Messages table for real-time direct messaging

1. New Tables
- `messages`
  - `id` (uuid, primary key)
  - `thread_id` (text, not null) — deterministic thread ID (sorted user IDs joined by __)
  - `sender_id` (uuid, not null) — references auth.users.id
  - `recipient_id` (uuid, not null) — references auth.users.id
  - `text` (text, not null) — message body
  - `read` (boolean, default false) — whether recipient has read it
  - `created_at` (timestamptz, default now())

2. Security
- Enable RLS on `messages`.
- Users can only SELECT/INSERT messages where they are the sender or recipient.
- Users can UPDATE (mark read) only messages sent to them.
- Users can DELETE only their own messages.
*/

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id text NOT NULL,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_unread ON messages(recipient_id, read) WHERE NOT read;

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- SELECT: only participants can read their messages
DROP POLICY IF EXISTS "messages_select_participants" ON messages;
CREATE POLICY "messages_select_participants" ON messages FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- INSERT: sender must be the authenticated user
DROP POLICY IF EXISTS "messages_insert_own" ON messages;
CREATE POLICY "messages_insert_own" ON messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- UPDATE: recipient can mark messages as read
DROP POLICY IF EXISTS "messages_update_recipient" ON messages;
CREATE POLICY "messages_update_recipient" ON messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- DELETE: sender can delete their own messages
DROP POLICY IF EXISTS "messages_delete_own" ON messages;
CREATE POLICY "messages_delete_own" ON messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);
