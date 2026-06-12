import { pgTable, text, timestamp, integer, json, boolean, uuid } from "drizzle-orm/pg-core";

export const channels = pgTable("channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  youtubeChannelId: text("youtube_channel_id").notNull().unique(),
  handle: text("handle").notNull(),
  name: text("name").notNull(),
  subscriberCount: integer("subscriber_count").default(0),
  healthScore: integer("health_score").default(100),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const videos = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id")
    .references(() => channels.id)
    .notNull(),
  youtubeVideoId: text("youtube_video_id").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  transcript: text("transcript"),
  thumbnailUrl: text("thumbnail_url"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const complianceScans = pgTable("compliance_scans", {
  id: uuid("id").primaryKey().defaultRandom(),
  videoId: uuid("video_id")
    .references(() => videos.id)
    .notNull(),
  status: text("status").notNull(), // 'pending', 'completed', 'failed'
  riskScore: integer("risk_score"), // 0-100 (0 = high risk, 100 = safe)
  originalityScore: integer("originality_score"),
  aiRawOutput: json("ai_raw_output"), // Store the raw JSON from OpenAI
  scannedAt: timestamp("scanned_at").defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  scanId: uuid("scan_id")
    .references(() => complianceScans.id)
    .notNull(),
  channelId: uuid("channel_id")
    .references(() => channels.id)
    .notNull(),
  severity: text("severity").notNull(), // 'low', 'medium', 'high', 'critical'
  type: text("type").notNull(), // 'policy_violation', 'clickbait_thumbnail', 'semantic_redundancy'
  title: text("title").notNull(),
  description: text("description").notNull(),
  impact: text("impact"), // e.g. "-10 pts monetization"
  resolved: boolean("resolved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const blogPosts = pgTable("blog_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  metaDescription: text("meta_description"),
  contentMarkdown: text("content_markdown"),
  coverImage: text("cover_image"),
  keywords: text("keywords").array(),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
