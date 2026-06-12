import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldAlert } from "lucide-react";

export function CTASection() {
  return (
    <section className="border-t bg-muted/30">
      <div className="mx-auto max-w-4xl px-4 py-24 md:px-6 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-6">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
          Check If Your YouTube Video Will Be Monetized Before You Upload
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Don't wait for a manual review to reject your channel. Scan videos, channels, thumbnails, scripts, AI content, and compliance risks before YouTube flags your content.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/register" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
            Start Free Audit <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">No credit card required. Connect your channel in 1 click.</p>
      </div>
    </section>
  );
}
