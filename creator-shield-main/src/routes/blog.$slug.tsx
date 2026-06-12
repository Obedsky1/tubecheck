import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { db } from "../server/db";
import { blogPosts } from "../server/db/schema";
import { eq } from "drizzle-orm";
import ReactMarkdown from "react-markdown";
import { Logo } from "@/components/brand/Logo";
import { ArrowLeft } from "lucide-react";

const fetchBlogPost = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const post = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.slug, slug),
    });
    
    if (!post) {
      throw notFound();
    }
    return post;
  });

export const Route = createFileRoute("/blog/$slug")({
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    return {
      meta: [
        { title: `${loaderData.title} | TubeCheck Blog` },
        { name: "description", content: loaderData.metaDescription || "" },
        { property: "og:title", content: loaderData.title },
        { property: "og:description", content: loaderData.metaDescription || "" },
        { property: "og:type", content: "article" },
        ...(loaderData.coverImage ? [
          { property: "og:image", content: loaderData.coverImage },
          { name: "twitter:image", content: loaderData.coverImage },
        ] : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: loaderData.title },
        { name: "twitter:description", content: loaderData.metaDescription || "" },
      ],
      links: [
        { rel: "canonical", href: `https://tubecheck.live/blog/${loaderData.slug}` }
      ]
    };
  },
  loader: async ({ params }) => {
    return await fetchBlogPost({ data: params.slug });
  },
  component: BlogPostPage,
});

function BlogPostPage() {
  const post = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 glass">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
          <Link to="/"><Logo /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-20">
        <div className="mb-8">
          <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="h-4 w-4" /> Back to blog
          </Link>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">{post.title}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-8">
            {post.publishedAt && (
              <time dateTime={new Date(post.publishedAt).toISOString()}>
                {new Date(post.publishedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </time>
            )}
            {post.keywords && post.keywords.length > 0 && (
              <div className="flex gap-2">
                {post.keywords.slice(0, 3).map((kw) => (
                  <span key={kw} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase font-semibold text-primary">{kw}</span>
                ))}
              </div>
            )}
          </div>
          {post.coverImage && (
            <div className="aspect-[21/9] w-full overflow-hidden rounded-xl border border-border/50 shadow-sm mb-12">
              <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
            </div>
          )}
        </div>
        
        <article className="max-w-none">
          <ReactMarkdown
            components={{
              h1: ({node, ...props}) => <h1 className="text-3xl font-bold mt-8 mb-4 text-foreground" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-2xl font-semibold mt-8 mb-4 text-foreground" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-xl font-semibold mt-6 mb-3 text-foreground" {...props} />,
              p: ({node, ...props}) => <p className="leading-7 [&:not(:first-child)]:mt-6 text-muted-foreground" {...props} />,
              ul: ({node, ...props}) => <ul className="my-6 ml-6 list-disc [&>li]:mt-2 text-muted-foreground" {...props} />,
              ol: ({node, ...props}) => <ol className="my-6 ml-6 list-decimal [&>li]:mt-2 text-muted-foreground" {...props} />,
              li: ({node, ...props}) => <li className="leading-7" {...props} />,
              strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
              a: ({node, ...props}) => <a className="font-medium text-primary underline underline-offset-4 hover:text-primary/80" {...props} />,
              blockquote: ({node, ...props}) => <blockquote className="mt-6 border-l-2 border-primary pl-6 italic text-muted-foreground" {...props} />,
            }}
          >
            {post.contentMarkdown || ""}
          </ReactMarkdown>
        </article>
      </main>
    </div>
  );
}
