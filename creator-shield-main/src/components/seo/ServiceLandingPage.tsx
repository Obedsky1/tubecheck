import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import type { SEOPageData } from "@/data/seo-pages";

// Import the new SEO Component Library
import { SEOHero } from "./SEOHero";
import { FAQSection } from "./FAQSection";
import { TrustIndicators } from "./TrustIndicators";
import { CTASection } from "./CTASection";
import { Breadcrumbs } from "./Breadcrumbs";

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 glass">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link to="/"><Logo /></Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <Link to="/app" className="hover:text-foreground">Dashboard</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground">Log in</Link>
          <Link to="/register" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 shadow-sm transition-transform hover:scale-105">
            Start free audit <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-card/40 mt-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 py-12 md:flex-row md:px-6">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-xs text-muted-foreground">
            Forensic compliance intelligence for YouTube creators, agencies, and networks.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 md:items-end">
          <div className="text-[11px] text-muted-foreground">© 2026 TubeCheck · All rights reserved</div>
        </div>
      </div>
    </footer>
  );
}

import { RelatedArticles } from "./RelatedArticles";

export function ServiceLandingPage({ pageData, slug, isToolRoute = false }: { pageData: SEOPageData, slug: string, isToolRoute?: boolean }) {
  const { h1, subtitle, faqs } = pageData;

  // Determine breadcrumb path dynamically using slug
  const finalPath = isToolRoute ? `/tools/${slug}` : `/${slug}`;
  const breadcrumbPath = isToolRoute 
    ? [{ label: "Tools", path: "/tools" }, { label: h1, path: finalPath }]
    : [{ label: h1, path: finalPath }];

  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <Breadcrumbs items={breadcrumbPath} />
      
      <SEOHero h1={h1} subtitle={subtitle} />
      <TrustIndicators />
      
      <FAQSection faqs={faqs} />
      
      <RelatedArticles currentServicePath={finalPath} />
      
      <CTASection />
      <Footer />
    </div>
  );
}
