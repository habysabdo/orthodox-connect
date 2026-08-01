CREATE TABLE "follows" (
	"follower_id" text,
	"following_id" text,
	"created_at" bigint NOT NULL,
	CONSTRAINT "follows_pkey" PRIMARY KEY("follower_id","following_id")
);
--> statement-breakpoint
CREATE INDEX "follows_follower_id_idx" ON "follows" ("follower_id");--> statement-breakpoint
CREATE INDEX "follows_following_id_idx" ON "follows" ("following_id");