import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Check, Sparkles, Zap, ChevronLeft, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export const Route = createFileRoute("/app/pricing")({
  component: PricingPage,
});

declare global {
  interface Window {
    FlutterwaveCheckout: (config: any) => void;
  }
}

const FLW_PUBLIC_KEY = import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY || "FLWPUBK_TEST-XXXX";

function PricingPage() {
  const { org, user, initialize } = useAuth();
  const currentPlan = (org?.plan_tier as string) || "FREE";
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const scriptRef = useRef<HTMLScriptElement | null>(null);

  // Inject Flutterwave inline JS SDK
  useEffect(() => {
    if (document.getElementById("flutterwave-sdk")) return;
    const script = document.createElement("script");
    script.id = "flutterwave-sdk";
    script.src = "https://checkout.flutterwave.com/v3.js";
    script.async = true;
    document.body.appendChild(script);
    scriptRef.current = script;
    return () => {
      // Leave the script mounted — removing it breaks subsequent calls
    };
  }, []);
  const plans = [
    {
      name: "FREE",
      tier: "FREE",
      title: "Free",
      price: 0,
      priceLabel: "$0",
      desc: "Connect your channel and receive a full audit including:",
      features: [
        "1 Channel Sync",
        "Reused Content Risk Detection",
        "Script Similarity Analysis",
        "Thumbnail Similarity Detection",
        "AI Voice Detection",
        "Shadowban Diagnostic",
        "Synthetic Media Detection",
        "Stock Footage Overuse Detection",
        "Transformative Value Analysis",
        "Monetization Readiness Score",
        "Channel Safety Recommendations",
        "Personalized Fix Suggestions",
        "Compliance Trend Tracking",
      ],
      cta: "Start Free",
      highlight: false,
      credits: "10 Credits Monthly",
      footer: "Perfect for creators who want to understand their channel risk profile before publishing.",
      comingSoon: false,
    },
    {
      name: "STARTER",
      tier: "STARTER",
      title: "Creator Starter",
      price: 10,
      priceLabel: "$10",
      desc: "Pro features with limited monthly scans for growing channels.",
      features: [
        "Everything in Free PLUS",
        "50 Credits Monthly",
        "Automated Daily Channel Monitoring",
        "AI Niche & RPM Checker",
        "RPM Opportunity Research",
        "Advanced Shadowban Diagnostics",
        "Early Warning Risk Alerts",
      ],
      cta: "Start Starter",
      highlight: false,
      credits: "50 Credits Monthly",
      footer: "Perfect for emerging creators who need automated protection.",
      comingSoon: false,
    },
    {
      name: "PRO",
      tier: "PRO",
      title: "Creator Pro",
      price: 49,
      priceLabel: "$49",
      desc: "For creators publishing consistently and managing multiple videos weekly.",
      features: [
        "Everything in Starter PLUS",
        "Unlimited Monthly Credits",
        "Priority Processing",
        "Historical Compliance Reports",
        "Competitor Comparison Insights",
        "Email Notifications",
      ],
      cta: "Upgrade to Pro",
      highlight: true,
      credits: "Unlimited Monthly Credits",
      footer: "Best for faceless channels, YouTube automation creators, and growing media brands.",
      comingSoon: false,
    },
    {
      name: "ENTERPRISE",
      tier: "ENTERPRISE",
      title: "Enterprise",
      price: 199,
      priceLabel: "$199",
      desc: "For agencies, creator teams, and multi-channel businesses.",
      features: [
        "Everything in Pro PLUS",
        "Unlimited Monthly Credits",
        "Multi-Channel Compliance Dashboard",
        "Channel Network Monitoring",
        "Cross-Channel Script Similarity Detection",
        "Shared Asset Detection",
        "Channel Farm Pattern Detection",
        "Team Members & Permissions",
        "White-Label Reports",
        "API Access",
        "Dedicated Support",
        "Custom Compliance Rules",
        "Advanced Forensic Analytics",
      ],
      cta: "Coming Soon",
      highlight: false,
      credits: "Unlimited Monthly Credits",
      footer: "Ideal for agencies and large creator networks.",
      comingSoon: true,
    },
  ];

  function handleUpgrade(plan: (typeof plans)[number]) {
    if (plan.comingSoon) return;
    
    if (plan.tier === "ENTERPRISE") {
      window.location.href = "mailto:sales@shieldnetwork.ai?subject=Enterprise%20Plan%20Inquiry";
      return;
    }
    
    if (currentPlan === plan.tier || plan.price === 0) return;

    if (!user || !org) {
      toast.error("Please log in first.");
      return;
    }

    if (!window.FlutterwaveCheckout) {
      toast.error("Payment SDK is still loading. Please wait a moment and try again.");
      return;
    }

    setLoadingPlan(plan.tier);

    window.FlutterwaveCheckout({
      public_key: FLW_PUBLIC_KEY,
      tx_ref: `cs-${org.id}-${plan.tier}-${Date.now()}`,
      amount: plan.price,
      currency: "USD",
      payment_options: "card,ussd",
      customer: {
        email: user.email,
        name: user.full_name,
      },
      customizations: {
        title: "CreatorShield",
        description: `Upgrade to ${plan.title} Plan`,
        logo: "https://tubecheck.live/favicon.png",
      },
      callback: async (response: any) => {
        if (response.status === "successful" || response.status === "completed") {
          try {
            const res = await api.verifyPayment(
              String(response.transaction_id),
              org.id,
              plan.tier,
            );
            if (res.success) {
              await initialize();
              toast.success(`🎉 You're now on the ${plan.title} plan!`);
            } else {
              toast.error("Payment received but plan upgrade failed. Contact support.");
            }
          } catch {
            toast.error("Payment received but plan update failed. Please contact support.");
          }
        } else {
          toast.error("Payment was not completed. Please try again.");
        }
        setLoadingPlan(null);
      },
      onclose: () => {
        setLoadingPlan(null);
      },
    });
  }

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] flex flex-col px-4 py-8 md:py-16">
      {/* Radial background glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />

      <div className="mx-auto w-full max-w-7xl space-y-10">
        <Link
          to="/app"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="mx-auto max-w-2xl text-center space-y-4">
          <div className="text-xs uppercase tracking-wider text-primary font-bold">Pricing</div>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
            Start Free. Scan Your Entire Channel.
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Connect your YouTube channel and instantly receive a complete compliance and monetization audit. 
            <span className="block mt-1 font-semibold text-foreground">No credits required · No credit card required.</span>
          </p>
          {currentPlan !== "FREE" && (
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Current plan: <span className="capitalize">{currentPlan.toLowerCase()}</span>
            </div>
          )}
        </div>

        {/* Plan cards */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 items-start">
          {plans.map((p) => {
            const isCurrent = currentPlan === p.tier;
            const isLoading = loadingPlan === p.tier;

            return (
              <div
                key={p.name}
                className={`relative rounded-2xl border p-6 transition-all duration-300 lg:hover:scale-[1.02] lg:hover:shadow-2xl lg:hover:shadow-primary/10 ${
                  p.highlight
                    ? "bg-card ring-1 ring-primary/45 border-primary/40 shadow-lg"
                    : "bg-card border-muted/30"
                }`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                    <Sparkles className="h-3 w-3" /> Most popular
                  </div>
                )}

                <div className="text-base font-bold tracking-tight">{p.title}</div>
                <div className="mt-1 text-xs text-muted-foreground min-h-[32px]">{p.desc}</div>

                <div className="mt-5 flex items-baseline gap-1">
                  <div className="text-4xl font-extrabold tracking-tight">{p.priceLabel}</div>
                  {p.price > 0 && (
                    <div className="text-xs text-muted-foreground">/mo</div>
                  )}
                </div>

                {/* Credits badge */}
                <div className="mt-4 rounded-lg bg-muted/35 border border-border/40 p-2 text-center">
                  <p className="text-xs font-bold text-foreground flex items-center justify-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                    {p.credits}
                  </p>
                </div>

                {/* Credit usage guidelines */}
                <div className="mt-4 text-[11px] text-muted-foreground border-t border-border/30 pt-3 space-y-1">
                  <div className="font-semibold text-foreground/80 text-[10px] uppercase tracking-wider mb-1">Credit Usage:</div>
                  <div className="flex justify-between">
                    <span>Pre-Publish Video Scan</span>
                    <span className="font-mono text-foreground font-semibold">1 Credit</span>
                  </div>
                  <div className="flex justify-between">
                    <span>AI Appeal Script Generator</span>
                    <span className="font-mono text-foreground font-semibold">5 Credits</span>
                  </div>
                </div>

                <ul className="mt-5 space-y-2.5 text-xs border-t border-border/30 pt-4">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-muted-foreground">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-foreground/90">{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  disabled={isCurrent || isLoading || p.price === 0 || p.comingSoon}
                  onClick={() => handleUpgrade(p)}
                  className={`mt-6 w-full rounded-md px-3 py-2.5 text-sm font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    p.highlight
                      ? "bg-primary text-primary-foreground hover:bg-primary/95 shadow-md shadow-primary/10"
                      : p.price === 0 || p.comingSoon
                      ? "border bg-background hover:bg-background/80"
                      : "border bg-card hover:bg-accent"
                  }`}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                    </span>
                  ) : p.comingSoon ? (
                    "Coming Soon"
                  ) : isCurrent ? (
                    "✓ Current Plan"
                  ) : p.price === 0 ? (
                    "Included"
                  ) : p.price < (plans.find(x => x.tier === currentPlan)?.price || 0) ? (
                    `Downgrade to ${p.title}`
                  ) : (
                    p.cta
                  )}
                </button>
                <p className="mt-4 text-[11px] text-muted-foreground text-center leading-relaxed font-medium">
                  {p.footer}
                </p>
              </div>
            );
          })}
        </div>

        {/* Why Is Channel Sync Free? */}
        <div className="mt-16 rounded-2xl border bg-card/45 glass p-8 md:p-12 relative overflow-hidden">
          <div className="pointer-events-none absolute -left-24 -top-24 w-92 h-92 rounded-full bg-primary/5 blur-[90px]" />
          <div className="grid gap-8 md:grid-cols-12 relative">
            <div className="md:col-span-6 space-y-4">
              <span className="text-xs uppercase tracking-wider text-primary font-bold">FAQ</span>
              <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Why Is Channel Sync Free?
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Most creators don't know they have monetization risks until YouTube takes action.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed font-medium">
                ShieldNetwork AI provides a free channel-wide audit so creators can understand:
              </p>
              <div className="pt-2">
                <Link
                  to="/app"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary hover:bg-primary/95 text-primary-foreground font-semibold px-5 py-2.5 text-sm transition-colors shadow-lg shadow-primary/25"
                >
                  Connect Your Channel
                </Link>
              </div>
            </div>
            <div className="md:col-span-6 flex flex-col justify-between space-y-6">
              <ul className="space-y-3">
                {[
                  "Why growth may be slowing",
                  "Whether content appears repetitive",
                  "Whether AI-generated content is creating risk",
                  "Whether thumbnails and scripts are too similar",
                  "Whether their channel shows reused-content signals",
                  "What actions can improve monetization readiness"
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-2.5 text-sm">
                    <span className="text-primary font-bold text-lg leading-none mt-0.5">•</span>
                    <span className="text-foreground/90 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border/30 pt-4">
                <p className="text-sm font-semibold text-foreground leading-relaxed">
                  Connect your channel. Get your risk report. Fix issues before they become problems.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground pt-4">
          Payments powered by Flutterwave · Secure card processing · Cancel anytime
        </p>
      </div>
    </div>
  );
}
