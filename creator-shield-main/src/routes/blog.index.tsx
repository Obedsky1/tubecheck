import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { db } from "../server/db";
import { blogPosts } from "../server/db/schema";
import { desc } from "drizzle-orm";
import { Logo } from "@/components/brand/Logo";

const fetchBlogPosts = createServerFn({ method: "GET" }).handler(async () => {
  return await db.query.blogPosts.findMany({
    orderBy: [desc(blogPosts.publishedAt)],
  });
});

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "TubeCheck Blog | Compliance & Monetization Insights" },
      { name: "description", content: "Read the latest insights on YouTube compliance, monetization, and AI-driven growth." },
    ],
  }),
  loader: async () => {
    return await fetchBlogPosts();
  },
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const posts = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 glass">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
          <Link to="/"><Logo /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-12 md:px-6 md:py-20">
        <h1 className="text-4xl font-bold tracking-tight mb-8">TubeCheck Blog</h1>
        <div className="grid gap-6 sm:grid-cols-2">
          {posts.map((post) => (
            <Link 
              key={post.id} 
              to="/blog/$slug" 
              params={{ slug: post.slug }}
              className="group relative flex flex-col rounded-xl border bg-card p-5 hairline transition-all hover:border-primary/40 hover:shadow-lg"
            >
              {post.coverImage && (
                <div className="mb-4 aspect-video w-full overflow-hidden rounded-lg">
                  <img src={post.coverImage} alt={post.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                </div>
              )}
              <h2 className="text-xl font-semibold tracking-tight group-hover:text-primary transition-colors">{post.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{post.metaDescription}</p>
              {post.publishedAt && (
                <div className="mt-4 text-xs text-muted-foreground">
                  {new Date(post.publishedAt).toLocaleDateString()}
                </div>
              )}
            </Link>
          ))}
          {posts.length === 0 && (
            <p className="text-muted-foreground">No posts found.</p>
          )}
        </div>
      </main>
    </div>
  );
}
