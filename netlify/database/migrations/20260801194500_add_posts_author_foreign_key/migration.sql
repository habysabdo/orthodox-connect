UPDATE "posts"
SET "author_id" = "data"->>'authorId'
WHERE "author_id" = ''
  AND COALESCE("data"->>'authorId', '') <> '';
--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "author_id" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "posts"
ADD CONSTRAINT "posts_author_id_users_id_fk"
FOREIGN KEY ("author_id") REFERENCES "users"("id")
ON DELETE CASCADE
NOT VALID;
