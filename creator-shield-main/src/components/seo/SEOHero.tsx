import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { AuditPreview } from "./AuditPreview";

interface SEOHeroProps {
  h1: string;
  subtitle: string;
}

export function SEOHero({ h1, subtitle }: SEOHeroProps) {
  return (
    <section className="relative overflow-hidden flex-1">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "var(--gradient-hero)" }} />
      <div className="pointer-events-none absolute inset-0 -z-10 grid-bg opacity-50 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:px-6 md:py-28">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="inline-flex items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs text-muted-foreground hairline shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Live Pre-Upload Scanner
          </div>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl text-gradient">
            {h1}
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            {subtitle}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/register" className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 shadow-sm transition-all hover:scale-105">
              Start Free Audit <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/app" className="inline-flex items-center gap-2 rounded-md border bg-card px-5 py-3 text-sm font-medium hover:bg-muted shadow-sm transition-all">
              View Sample Report
            </Link>
          </div>
          <div className="mt-8 flex items-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> Free Channel Analysis</div>
            <div className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-success" /> Instant Algorithmic Results</div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }}>
          <AuditPreview />
        </motion.div>
      </div>
    </section>
  );
}
