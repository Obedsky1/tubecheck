import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { rootPages, toolPages } from "@/data/seo-pages";
import { db } from "@/server/db";
import { blogPosts } from "@/server/db/schema";

const BASE_URL = "https://tubecheck.live";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/app", changefreq: "daily", priority: "0.8" },
          { path: "/app/forensics", changefreq: "weekly", priority: "0.8" },
          { path: "/app/niche-finder", changefreq: "weekly", priority: "0.8" },
          { path: "/blog", changefreq: "daily", priority: "0.8" },
        ];

        // Inject root service pages
        Object.keys(rootPages).forEach((slug) => {
          entries.push({ path: `/${slug}`, changefreq: "weekly", priority: "0.9" });
        });

        // Inject tool service pages
        Object.keys(toolPages).forEach((slug) => {
          entries.push({ path: `/tools/${slug}`, changefreq: "weekly", priority: "0.9" });
        });

        // Inject database-driven blog posts
        try {
          const posts = await db.select({ slug: blogPosts.slug }).from(blogPosts);
          posts.forEach((post) => {
            entries.push({ path: `/blog/${post.slug}`, changefreq: "monthly", priority: "0.7" });
          });
        } catch (error) {
          console.error("Failed to fetch blog posts for sitemap", error);
        }

        const urls = entries.map((e) =>
          `  <url><loc>${BASE_URL}${e.path}</loc><changefreq>${e.changefreq}</changefreq><priority>${e.priority}</priority></url>`
        );
        
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");
        
        return new Response(xml, { 
          headers: { 
            "Content-Type": "application/xml", 
            "Cache-Control": "public, max-age=3600" 
          } 
        });
      },
    },
  },
});
