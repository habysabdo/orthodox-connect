-- Seed the admin alert feed with the accounts that already existed when the feed
-- was introduced, so the console shows real signup history from day one. These
-- rows are inserted as read: an account that joined weeks ago is history, not a
-- new alert, and the unread badge should only ever count genuine new signups.
-- The id matches the `new-user-<account id>` key the application writes, so a
-- later sign-in by one of these members cannot duplicate their alert.
INSERT INTO "admin_notifications" (
  "id", "type", "subject_id", "subject_email", "subject_name", "message", "read", "created_at"
)
SELECT
  'new-user-' || "id",
  'new_user',
  "id",
  "email",
  "name",
  'New user registered: ' || COALESCE(NULLIF("email", ''), "name"),
  true,
  (EXTRACT(EPOCH FROM "created_at") * 1000)::bigint
FROM "users"
ON CONFLICT ("id") DO NOTHING;
