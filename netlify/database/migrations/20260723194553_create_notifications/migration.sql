CREATE TABLE "notifications" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_name" text DEFAULT '' NOT NULL,
	"type" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"post_id" text,
	"thread_id" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL
);
