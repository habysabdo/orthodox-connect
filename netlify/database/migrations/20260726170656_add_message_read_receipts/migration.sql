ALTER TABLE "messages" ADD COLUMN "is_read" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "read_at" timestamp with time zone;--> statement-breakpoint
UPDATE "messages"
SET
  "is_read" = COALESCE(("data"->>'isRead')::boolean, ("data"->>'read')::boolean, true),
  "read_at" = CASE
    WHEN COALESCE(("data"->>'isRead')::boolean, ("data"->>'read')::boolean, true)
      THEN to_timestamp("created_at" / 1000.0)
    ELSE NULL
  END;--> statement-breakpoint
CREATE INDEX "messages_thread_read_idx" ON "messages" ("thread_id","is_read");
