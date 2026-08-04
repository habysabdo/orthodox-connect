CREATE TABLE "chat_attachments" (
	"id" text PRIMARY KEY,
	"blob_key" text NOT NULL UNIQUE,
	"thread_id" text NOT NULL,
	"uploader_id" text NOT NULL,
	"kind" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" bigint NOT NULL,
	"duration" integer,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "chat_attachments_thread_id_idx" ON "chat_attachments" ("thread_id");--> statement-breakpoint
CREATE INDEX "chat_attachments_uploader_id_idx" ON "chat_attachments" ("uploader_id");