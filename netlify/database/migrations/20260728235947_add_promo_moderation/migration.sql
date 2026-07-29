ALTER TABLE "posts" ADD COLUMN "post_type" text DEFAULT 'regular' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "status" text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
CREATE INDEX "posts_moderation_idx" ON "posts" ("post_type","status","created_at");