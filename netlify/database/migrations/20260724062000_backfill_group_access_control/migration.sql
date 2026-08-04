INSERT INTO "users" ("id", "email", "name", "role", "status", "created_at")
SELECT
  "user_id",
  COALESCE("data" ->> 'email', ''),
  COALESCE(NULLIF("data" ->> 'name', ''), 'Parish Member'),
  CASE WHEN "data" ->> 'role' = 'admin' THEN 'admin'::"user_role" ELSE 'user'::"user_role" END,
  'active'::"user_status",
  CASE
    WHEN ("data" ->> 'joinedAt') ~ '^[0-9]+$' THEN to_timestamp((("data" ->> 'joinedAt')::double precision) / 1000)
    ELSE "updated_at" AT TIME ZONE 'UTC'
  END
FROM "user_profiles"
ON CONFLICT ("id") DO UPDATE SET
  "email" = EXCLUDED."email",
  "name" = EXCLUDED."name";

UPDATE "posts"
SET
  "content" = COALESCE("data" ->> 'text', ''),
  "author_id" = COALESCE("data" ->> 'authorId', '')
WHERE "content" = '' OR "author_id" = '';
