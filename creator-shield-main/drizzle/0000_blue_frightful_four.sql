CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"severity" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"impact" text,
	"resolved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"meta_description" text,
	"content_markdown" text,
	"cover_image" text,
	"keywords" text[],
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"youtube_channel_id" text NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"subscriber_count" integer DEFAULT 0,
	"health_score" integer DEFAULT 100,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "channels_youtube_channel_id_unique" UNIQUE("youtube_channel_id")
);
--> statement-breakpoint
CREATE TABLE "compliance_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"status" text NOT NULL,
	"risk_score" integer,
	"originality_score" integer,
	"ai_raw_output" json,
	"scanned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"youtube_video_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"transcript" text,
	"thumbnail_url" text,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "videos_youtube_video_id_unique" UNIQUE("youtube_video_id")
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_scan_id_compliance_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."compliance_scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_scans" ADD CONSTRAINT "compliance_scans_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;