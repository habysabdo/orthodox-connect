import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const userStatus = pgEnum("user_status", ["active", "blocked"]);
export const groupMemberRole = pgEnum("group_member_role", ["creator", "admin", "member"]);
export const groupMemberStatus = pgEnum("group_member_status", ["pending", "approved"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  name: text("name").notNull().default("Parish Member"),
  role: userRole("role").notNull().default("user"),
  status: userStatus("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Full user profile, stored as a JSON document keyed by user id.
export const userProfiles = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Feed posts. The whole post (text, image, likes, comments, flag state) is
// stored as a JSON document so nested likes/comments persist with the post.
// `created_at` (epoch ms, matching the client's Date.now()) is kept as its own
// column so the feed can be ordered newest-first at the database.
export const posts = pgTable("posts", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
  content: text("content").notNull().default(""),
  authorId: text("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  groupId: text("group_id"),
  postType: text("post_type").notNull().default("regular"),
  status: text("status").notNull().default("approved"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("posts_group_id_idx").on(table.groupId),
  index("posts_author_id_idx").on(table.authorId),
  index("posts_moderation_idx").on(table.postType, table.status, table.createdAt),
]);

export const postReshares = pgTable("post_reshares", {
  id: text("id").primaryKey(),
  originalPostId: text("original_post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  resharedPostId: text("reshared_post_id")
    .notNull()
    .unique()
    .references(() => posts.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  kind: text("kind").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("post_reshares_original_post_id_idx").on(table.originalPostId),
  index("post_reshares_user_id_idx").on(table.userId),
]);

export const groups = pgTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("groups_created_by_idx").on(table.createdBy)]);

export const groupMembers = pgTable("group_members", {
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  role: groupMemberRole("role").notNull().default("member"),
  // 'approved' members have full access to the group; 'pending' members have
  // requested to join via group discovery and are awaiting approval. Defaults
  // to 'approved' so every membership that predates discovery keeps its access.
  status: groupMemberStatus("status").notNull().default("approved"),
}, (table) => [
  primaryKey({ columns: [table.groupId, table.userId] }),
  index("group_members_user_id_idx").on(table.userId),
]);

// Direct chat messages. Stored as a JSON document with `thread_id` and
// `created_at` (epoch ms) promoted to columns for filtering and ordering.
export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  threadId: text("thread_id").notNull(),
  data: jsonb("data").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [index("messages_thread_read_idx").on(table.threadId, table.isRead)]);

// Browser push endpoints are stored per user and device. Presence fields let
// message delivery skip a device that is currently viewing the same thread.
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  deviceId: text("device_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  activeThreadId: text("active_thread_id"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("push_subscriptions_user_id_idx").on(table.userId),
  index("push_subscriptions_user_device_idx").on(table.userId, table.deviceId),
]);

export const chatAttachments = pgTable("chat_attachments", {
  id: text("id").primaryKey(),
  blobKey: text("blob_key").notNull().unique(),
  threadId: text("thread_id").notNull(),
  uploaderId: text("uploader_id").notNull(),
  kind: text("kind").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  duration: integer("duration"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("chat_attachments_thread_id_idx").on(table.threadId),
  index("chat_attachments_uploader_id_idx").on(table.uploaderId),
]);

// Social graph between registered members. One canonical row per pair, keyed
// by the two user ids sorted and joined (`a__b`). `requester`/`addressee`
// record the direction of the original request so each side can be shown the
// right "incoming"/"outgoing" state; `status` is 'pending' until accepted.
export const friendships = pgTable("friendships", {
  id: text("id").primaryKey(),
  requester: text("requester").notNull(),
  addressee: text("addressee").notNull(),
  status: text("status").notNull(),
  since: bigint("since", { mode: "number" }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Directory of Orthodox parishes, searchable from the global search bar.
export const churches = pgTable("churches", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  jurisdiction: text("jurisdiction").notNull().default(""),
  city: text("city").notNull().default(""),
  region: text("region").notNull().default(""),
  description: text("description").notNull().default(""),
});

// In-app notifications addressed to a specific member. Each row is delivered to
// the recipient (`user_id`) and describes something another member (`actor_id`)
// did — currently a like on their post or a direct message. `post_id` and
// `thread_id` carry the click-through target for the two notification kinds.
// `created_at` (epoch ms, matching the client's Date.now()) drives newest-first
// ordering; `is_read` backs the unread badge and "Mark all as read".
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name").notNull().default(""),
  type: text("type").notNull(),
  content: text("content").notNull().default(""),
  postId: text("post_id"),
  threadId: text("thread_id"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

// Console-wide alerts for administrators, independent of the per-member
// `notifications` table above. A row is written whenever something happens that
// the admin team should see — currently a brand-new account registering. Rows
// are not addressed to one admin: every administrator reads the same feed, and
// `read` is cleared for everyone by "Mark all as read". `subject_id`/
// `subject_email` identify the account the alert is about, and `created_at`
// (epoch ms, matching the client's Date.now()) drives newest-first ordering.
export const adminNotifications = pgTable("admin_notifications", {
  id: text("id").primaryKey(),
  type: text("type").notNull().default("new_user"),
  subjectId: text("subject_id"),
  subjectEmail: text("subject_email").notNull().default(""),
  subjectName: text("subject_name").notNull().default(""),
  message: text("message").notNull().default(""),
  read: boolean("read").notNull().default(false),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (table) => [
  index("admin_notifications_read_idx").on(table.read),
  index("admin_notifications_created_at_idx").on(table.createdAt),
]);

// Catalog of hymns and liturgical songs, searchable from the global search bar.
export const hymns = pgTable("hymns", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  composer: text("composer").notNull().default(""),
  tone: text("tone").notNull().default(""),
  lyrics: text("lyrics").notNull().default(""),
});
