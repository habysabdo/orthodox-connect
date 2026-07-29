CREATE TABLE "messages" (
	"id" text PRIMARY KEY,
	"thread_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" text PRIMARY KEY,
	"data" jsonb NOT NULL,
	"created_at" bigint NOT NULL
);
