ALTER TABLE "group_members" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "group_member_role" RENAME TO "group_member_role_old";--> statement-breakpoint
CREATE TYPE "group_member_role" AS ENUM('creator', 'admin', 'member');--> statement-breakpoint
ALTER TABLE "group_members" ALTER COLUMN "role" TYPE "group_member_role" USING "role"::text::"group_member_role";--> statement-breakpoint
ALTER TABLE "group_members" ALTER COLUMN "role" SET DEFAULT 'member'::"group_member_role";--> statement-breakpoint
DROP TYPE "group_member_role_old";--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
