CREATE TYPE "group_member_role" AS ENUM('admin', 'member');--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "user_status" AS ENUM('active', 'blocked');--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" text,
	"user_id" text,
	"role" "group_member_role" DEFAULT 'member'::"group_member_role" NOT NULL,
	CONSTRAINT "group_members_pkey" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"email" text NOT NULL,
	"name" text DEFAULT 'Parish Member' NOT NULL,
	"role" "user_role" DEFAULT 'user'::"user_role" NOT NULL,
	"status" "user_status" DEFAULT 'active'::"user_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "content" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "author_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "group_id" text;--> statement-breakpoint
CREATE INDEX "group_members_user_id_idx" ON "group_members" ("user_id");--> statement-breakpoint
CREATE INDEX "groups_created_by_idx" ON "groups" ("created_by");--> statement-breakpoint
CREATE INDEX "posts_group_id_idx" ON "posts" ("group_id");--> statement-breakpoint
CREATE INDEX "posts_author_id_idx" ON "posts" ("author_id");--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE;