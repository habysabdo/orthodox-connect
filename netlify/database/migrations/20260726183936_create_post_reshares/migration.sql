CREATE TABLE "post_reshares" (
	"id" text PRIMARY KEY,
	"original_post_id" text NOT NULL,
	"reshared_post_id" text NOT NULL UNIQUE,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "post_reshares_original_post_id_idx" ON "post_reshares" ("original_post_id");--> statement-breakpoint
CREATE INDEX "post_reshares_user_id_idx" ON "post_reshares" ("user_id");--> statement-breakpoint
ALTER TABLE "post_reshares" ADD CONSTRAINT "post_reshares_original_post_id_posts_id_fkey" FOREIGN KEY ("original_post_id") REFERENCES "posts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "post_reshares" ADD CONSTRAINT "post_reshares_reshared_post_id_posts_id_fkey" FOREIGN KEY ("reshared_post_id") REFERENCES "posts"("id") ON DELETE CASCADE;