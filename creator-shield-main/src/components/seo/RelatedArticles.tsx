import { Link } from "@tanstack/react-router";
import { contentClusters } from "@/data/clusters";
import { ArrowRight, BookOpen } from "lucide-react";

export function RelatedArticles({ currentServicePath }: { currentServicePath: string }) {
  // Find up to 6 articles that link directly to this service page to build strong topical clusters
  const related = contentClusters.filter(c => c.link === currentServicePath).slice(0, 6);

  if (related.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-24 md:px-6 w-full">
      <div className="flex items-center gap-2 mb-8">
        <BookOpen className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-semibold tracking-tight">Related Educational Resources</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((article) => (
          <Link
            key={article.slug}
            to={`/blog/${article.slug}`}
            className="group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/50"
          >
            <div>
              <div className="mb-3 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                {article.cluster}
              </div>
              <h3 className="text-lg font-medium leading-tight group-hover:text-primary transition-colors">
                {article.title}
              </h3>
            </div>
            <div className="mt-6 flex items-center text-sm font-medium text-muted-foreground group-hover:text-primary transition-colors">
              Read guide <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
