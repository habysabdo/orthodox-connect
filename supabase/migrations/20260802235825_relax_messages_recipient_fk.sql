/*
# Relax recipient_id FK constraint

The messages table currently requires both sender_id and recipient_id to
reference auth.users(id). In the demo, the authenticated user messages
mock users whose IDs are not in auth.users. Drop the FK on recipient_id
so messages can be sent to any UUID while sender_id still must be a real
authenticated user.
*/

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_recipient_id_fkey;
