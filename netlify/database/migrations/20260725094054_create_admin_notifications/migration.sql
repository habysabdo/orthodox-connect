CREATE TABLE "admin_notifications" (
	"id" text PRIMARY KEY,
	"type" text DEFAULT 'new_user' NOT NULL,
	"subject_id" text,
	"subject_email" text DEFAULT '' NOT NULL,
	"subject_name" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "admin_notifications_read_idx" ON "admin_notifications" ("read");--> statement-breakpoint
CREATE INDEX "admin_notifications_created_at_idx" ON "admin_notifications" ("created_at");