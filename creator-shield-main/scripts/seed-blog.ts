import { db } from "../src/server/db";
import { blogPosts } from "../src/server/db/schema";
import * as fs from "fs";
import * as path from "path";

async function seed() {
  console.log("Seeding massive blog clusters to database...");

  const contentDir = path.join(process.cwd(), "content", "blog");
  const files = fs.readdirSync(contentDir).filter(file => file.endsWith(".md"));

  console.log(`Found ${files.length} markdown files to seed.`);

  for (const filename of files) {
    const filePath = path.join(contentDir, filename);
    const rawContent = fs.readFileSync(filePath, "utf-8");

    // Extremely simple frontmatter parser for our structured output
    const titleMatch = rawContent.match(/title:\s*"([^"]+)"/);
    const slugMatch = rawContent.match(/slug:\s*"([^"]+)"/);
    const metaMatch = rawContent.match(/metaDescription:\s*"([^"]+)"/);
    const imageMatch = rawContent.match(/coverImage:\s*"([^"]+)"/);
    const keywordsMatch = rawContent.match(/keywords:\s*\[(.*?)\]/);
    
    if (!titleMatch || !slugMatch) {
      console.warn(`Skipping ${filename} due to missing frontmatter`);
      continue;
    }

    const title = titleMatch[1];
    const slug = slugMatch[1];
    const metaDescription = metaMatch ? metaMatch[1] : "";
    const coverImage = imageMatch ? imageMatch[1] : "";
    
    let keywords: string[] = [];
    if (keywordsMatch && keywordsMatch[1]) {
      keywords = keywordsMatch[1]
        .split(",")
        .map(k => k.trim().replace(/"/g, ""))
        .filter(k => k.length > 0);
    }

    // Extract everything after the second '---' as the body
    const parts = rawContent.split("---");
    const contentMarkdown = parts.length >= 3 ? parts.slice(2).join("---").trim() : rawContent;

    try {
      await db.insert(blogPosts).values({
        title,
        slug,
        metaDescription,
        contentMarkdown,
        coverImage,
        keywords,
        publishedAt: new Date(),
      });
      console.log(`✅ Seeded: ${slug}`);
    } catch (err: any) {
      if (err.code === '23505') { // Postgres unique violation
        console.log(`🔄 Updating: ${slug}`);
        await db.update(blogPosts)
          .set({
            title,
            metaDescription,
            contentMarkdown,
            coverImage,
            keywords,
            publishedAt: new Date(),
          })
          .where(blogPosts.slug.equals(slug));
      } else {
        console.error(`❌ Error seeding '${slug}':`, err);
      }
    }
  }

  console.log("Blog seeding complete!");
  process.exit(0);
}

seed();
