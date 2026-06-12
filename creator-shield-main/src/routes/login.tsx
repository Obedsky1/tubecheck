import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabaseClient";
import { Logo } from "@/components/brand/Logo";
import {
  ArrowLeft,
  Loader2,
  Lock,
  Mail,
  Check,
  ExternalLink,
  MessageCircle,
  Heart,
  Repeat2,
  ShieldAlert,
  Sun,
  Moon,
} from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log In | TubeCheck" },
      { name: "description", content: "Log in to your TubeCheck account to monitor your YouTube channels." },
    ],
  }),
  component: LoginPage,
});

interface Tweet {
  id: string;
  user: {
    name: string;
    handle: string;
    avatar: string;
    verified: boolean;
  };
  text: string;
  tag: string;
  media?: string;
  metrics: {
    replies: number;
    retweets: number;
    likes: number;
  };
  date: string;
}

const TWEETS: Tweet[] = [
  {
    id: "2062750449095082074",
    user: {
      name: "MrParadox",
      handle: "@MrParadox6000",
      avatar: "https://pbs.twimg.com/profile_images/1890391537181204480/v0lc8vVb_normal.jpg",
      verified: true
    },
    text: "Same thing for me brotha I have 194k subs verified channel and everyday yt needs to fix their ai system or something because they’re banning innocent channels",
    tag: "Auto-Terminated",
    media: "https://pbs.twimg.com/media/HKBcmfkXgAARLUs.jpg",
    metrics: { replies: 4, retweets: 1, likes: 3 },
    date: "Jun 5, 2026"
  },
  {
    id: "2063013667587690572",
    user: {
      name: "Islandneofr",
      handle: "@Joe2ShiestyLit",
      avatar: "https://pbs.twimg.com/profile_images/2056095315686494208/DsB-5LAP_normal.jpg",
      verified: false
    },
    text: "Day 13\n\nI’m respectfully requesting a genuine human review of my terminated clean 40k Roblox channel.\n\nThis started on my very first YouTube account. I made a rookie mistake with aggressive CTA phrasing (“if you need help with this… drop a like/sub/follow on Roblox”). No links...",
    tag: "Terminated (40k)",
    media: "https://pbs.twimg.com/media/HKFL_puWwAAoXJP.jpg",
    metrics: { replies: 54, retweets: 12, likes: 20 },
    date: "Jun 5, 2026"
  },
  {
    id: "2062834119596245048",
    user: {
      name: "poor_kiddo",
      handle: "@StuffAnswered",
      avatar: "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png",
      verified: false
    },
    text: "Been demonetized for 4 months by youtube's rogue AI.\nNot only did they confiscate my earnings, but now they started charging me for my views 😂\n\nNo one treats their partners better than youtube.\n\nThis is what you get for building on their platform for 5yrs\n\n@TeamYouTube @YouTube",
    tag: "Demonetized (5 Years)",
    media: "https://pbs.twimg.com/media/HKCoHfCWwAAAGsQ.png",
    metrics: { replies: 4, retweets: 0, likes: 11 },
    date: "Jun 5, 2026"
  },
  {
    id: "2062964423933722859",
    user: {
      name: "Zoe Delahunty-Light",
      handle: "@zoe_dels",
      avatar: "https://pbs.twimg.com/profile_images/1826229562826428416/LPAd1mvn_normal.jpg",
      verified: true
    },
    text: "hey @TeamYouTube can you help me? My YouTube channel (original videos about videogame lore) is running up against AdSense criteria although my content is authentic and has an engaged genuine audience. Would love to know what programme criteria I'm somehow now meeting?",
    tag: "Monetization Audit",
    media: "https://pbs.twimg.com/media/HKEfNhTXwAAgfpA.jpg",
    metrics: { replies: 2, retweets: 1, likes: 16 },
    date: "Jun 5, 2026"
  },
  {
    id: "2062914334402240909",
    user: {
      name: "Dark Knight",
      handle: "@DarkKnight_04",
      avatar: "https://pbs.twimg.com/profile_images/2046916556123430912/fxL1IgXw_normal.jpg",
      verified: false
    },
    text: "1️⃣ My channel was demonetized for \"inauthentic content\" without any indication of which videos were at fault. To ensure I was 100% compliant, I took the initiative to delete over 20 videos to completely clean up my channel. 1/3 @TeamYouTube",
    tag: "Demonetized",
    media: "https://pbs.twimg.com/media/HKDwePgagAAxp3o.png",
    metrics: { replies: 3, retweets: 3, likes: 9 },
    date: "Jun 5, 2026"
  },
  {
    id: "2062930880772096374",
    user: {
      name: "Dragon Boy Edits",
      handle: "@DragonBoyEdits",
      avatar: "https://pbs.twimg.com/profile_images/2045260187578281984/HL5kkBId_normal.jpg",
      verified: false
    },
    text: "dear @TeamYouTube @YouTubeCreators @YouTube Please help, I need a human to review it, not an automated reply",
    tag: "Automated Rejection",
    media: "https://pbs.twimg.com/media/HKEAs_kbgAAwipv.jpg",
    metrics: { replies: 3, retweets: 2, likes: 11 },
    date: "Jun 5, 2026"
  },
  {
    id: "2062681654246690908",
    user: {
      name: "Maria",
      handle: "@mariaiscool29",
      avatar: "https://pbs.twimg.com/profile_images/2062682159068889088/s2_z7C7e_normal.jpg",
      verified: false
    },
    text: "My main YouTube channel is still live on YouTube today, but I can't access it.\n\nOver 2 months ago, one of my channels was terminated for \"Spam, deceptive practices and scams.\" Since then, I've lost access to my main channel, despite it still being publicly visible with all of its videos...",
    tag: "Locked Out",
    media: "https://pbs.twimg.com/media/HKAd8XlW8AAbZHY.jpg",
    metrics: { replies: 6, retweets: 1, likes: 18 },
    date: "Jun 4, 2026"
  },
  {
    id: "2062535397025202570",
    user: {
      name: "fhan",
      handle: "@fhanv7av",
      avatar: "https://pbs.twimg.com/profile_images/2062533221645197313/gzLi-ZZM_normal.jpg",
      verified: false
    },
    text: "Dear @TeamYouTube My channel was demonetized due to inauthentic violations, after waiting 90 days I re-applied for YPP and the result was still rejected, the violation changed to the related channel, I request a re-review for my channel, thank you.",
    tag: "Appeal Rejected",
    media: "https://pbs.twimg.com/media/HJ-ZA4GbcAA_xop.jpg",
    metrics: { replies: 7, retweets: 1, likes: 15 },
    date: "Jun 4, 2026"
  }
];

function LoginPage() {
  const { login, token, error: authError, loading, initialize } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const navigate = useNavigate();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (token) {
      navigate({ to: "/app" });
    }
  }, [token, navigate]);

  useEffect(() => {
    // Sync theme with local storage or system preferences
    const storedTheme = localStorage.getItem("theme") as "dark" | "light" | null;
    if (storedTheme) {
      setTheme(storedTheme);
      document.documentElement.classList.toggle("light", storedTheme === "light");
    } else {
      const prefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
      if (prefersLight) {
        setTheme("light");
        document.documentElement.classList.add("light");
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.classList.toggle("light", nextTheme === "light");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password) {
      setLocalError("Please fill in all fields");
      return;
    }

    try {
      await login(email, password);
    } catch (err: any) {
      // Error handled in zustand store
    }
  };

  const displayError = localError || authError;

  // Highlights handles and hashtags in tweets
  const formatTweetText = (text: string) => {
    const parts = text.split(/(\s+)/);
    return parts.map((part, index) => {
      if (part.startsWith("@") || part.startsWith("#")) {
        return (
          <span key={index} className="text-primary hover:underline cursor-pointer">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="relative min-h-screen grid lg:grid-cols-12 bg-background transition-colors duration-300">
      {/* Theme Toggle Button */}
      <button
        type="button"
        onClick={toggleTheme}
        className="absolute top-4 right-4 z-50 p-2 rounded-lg border border-border/40 bg-card/60 backdrop-blur-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer hairline"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      {/* Background Grids and Ambient Glows */}
      <div className="pointer-events-none absolute inset-0 -z-10 grid-bg opacity-20 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <div className="pointer-events-none absolute top-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] opacity-60" />
      <div className="pointer-events-none absolute bottom-1/3 right-1/4 w-[500px] h-[500px] rounded-full bg-secondary/15 blur-[120px] opacity-40" />

      {/* LEFT COLUMN: Twitter / X Threat Social Proof Wall (Hidden on mobile/tablet) */}
      <div className="hidden lg:flex lg:col-span-6 flex-col justify-between p-6 xl:p-8 border-r border-border/40 bg-card/25 backdrop-blur-[2px]">
        {/* Top Header */}
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-destructive/20 bg-destructive/5 text-[10px] font-medium text-destructive tracking-wide uppercase hairline">
            <ShieldAlert className="h-3 w-3 animate-pulse" />
            Monetization Threat Alert
          </div>
          <h1 className="text-2xl xl:text-3xl font-semibold leading-[1.15] text-gradient">
            Rogue AI terminations are out of control.
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Every day, original creators are demonetized or terminated overnight by automated policy algorithms. TubeCheck monitors your fleet preemptively so you stay safe.
          </p>
        </div>

        {/* Scrollable Tweets Grid */}
        <div className="mt-6 mb-4 flex-1 max-h-[65vh] xl:max-h-[70vh] overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          <div className="columns-1 xl:columns-2 gap-4 space-y-4">
            {TWEETS.map((tweet) => (
              <div
                key={tweet.id}
                className="break-inside-avoid relative rounded-xl border border-border/40 bg-card/50 glass hairline p-4 shadow-md transition-all hover:border-primary/40 hover:shadow-lg group"
              >
                {/* Header info */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={tweet.user.avatar}
                      alt={tweet.user.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png";
                      }}
                      className="h-9 w-9 rounded-full border border-border bg-muted object-cover"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold text-foreground truncate max-w-[100px]">
                          {tweet.user.name}
                        </span>
                        {tweet.user.verified && (
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5 text-primary fill-current"
                          >
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </svg>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground block truncate">
                        {tweet.user.handle}
                      </span>
                    </div>
                  </div>

                  <span className="shrink-0 text-[9px] font-semibold border border-destructive/20 bg-destructive/10 text-destructive rounded-full px-2 py-0.5">
                    {tweet.tag}
                  </span>
                </div>

                {/* Tweet Body */}
                <p className="text-[11px] xl:text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">
                  {formatTweetText(tweet.text)}
                </p>

                {/* Media Attachment */}
                {tweet.media && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-border/30 bg-muted/20">
                    <img
                      src={tweet.media}
                      alt="Tweet attachment"
                      className="w-full h-auto max-h-[140px] object-cover transition-transform group-hover:scale-[1.01]"
                      loading="lazy"
                    />
                  </div>
                )}

                {/* Footer / Actions */}
                <div className="mt-4 pt-3 border-t border-border/20 flex items-center justify-between text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" /> {tweet.metrics.replies}
                    </span>
                    <span className="flex items-center gap-1">
                      <Repeat2 className="h-3 w-3" /> {tweet.metrics.retweets}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" /> {tweet.metrics.likes}
                    </span>
                  </div>
                  <a
                    href={`https://x.com/i/status/${tweet.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-0.5 hover:text-foreground text-primary transition-colors font-medium"
                  >
                    View Post <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom indicator */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/20 pt-4">
          <span>Real reports tracked on X</span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" /> Live database integration
          </span>
        </div>
      </div>

      {/* RIGHT COLUMN: Sign In Card & Features Checklist */}
      <div className="lg:col-span-6 flex items-start justify-center p-6 sm:p-8 md:p-12 py-12">
        <div className="w-full max-w-md space-y-6">
          {/* Back Home & Mobile Logo */}
          <div className="flex items-center justify-between lg:justify-start">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-xs transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Back to home
            </Link>
            <div className="lg:hidden">
              <Logo />
            </div>
          </div>

          {/* Glasp-style Title & Subtitle */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
            <div className="hidden lg:block">
              <Logo />
            </div>
            <h2 className="mt-5 text-2xl sm:text-3xl font-semibold tracking-tight text-gradient">
              Welcome to TubeCheck
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Join 1,200+ channels shielding their monetization with TubeCheck.
            </p>
          </div>

          {/* Login Form Panel */}
          <div className="rounded-2xl border border-border/40 bg-card/60 glass p-6 shadow-xl hairline">
            <form onSubmit={handleSubmit} className="space-y-4">
              {displayError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[11px] text-destructive">
                  {displayError}
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-medium text-muted-foreground"
                >
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <Mail className="h-4 w-4" />
                  </span>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    disabled={loading}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 transition-colors"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label
                    htmlFor="password"
                    className="text-xs font-medium text-muted-foreground"
                  >
                    Password
                  </label>
                  <a href="#" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <Lock className="h-4 w-4" />
                  </span>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                    className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50 transition-colors"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2 px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 active:scale-[0.98] cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>

            {/* SSO Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/30" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-card px-2.5 text-muted-foreground font-medium">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Mock SSO Buttons */}
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={async () => {
                  if (!supabase) return alert("Supabase is not configured.");
                  await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: `${window.location.origin}/auth/callback`
                    }
                  });
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 border border-border/40 rounded-lg text-xs font-semibold bg-background/30 hover:bg-background/80 transition-colors active:scale-[0.98] cursor-pointer text-foreground/90"
              >
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                Google
              </button>
            </div>

            <div className="mt-6 text-center text-xs text-muted-foreground">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-primary hover:underline font-medium"
              >
                Create an account
              </Link>
            </div>
          </div>

          {/* Feature Checklist */}
          <div className="rounded-2xl border border-border/40 bg-card/30 glass p-5 space-y-3.5 hairline">
            {[
              {
                t: "Pre-Upload Forensic Scans",
                d: "Scan drafts for transcription spins and algorithmic triggers before posting.",
              },
              {
                t: "Semantic Asset Deduplication",
                d: "Ensure frame sequences and visual templates don't raise reuse flags.",
              },
              {
                t: "Synthetic Narrator Verification",
                d: "Analyze AI voices for altered content disclosure compliance.",
              },
              {
                t: "Upload Pacing Alerts",
                d: "Prevent sudden upload spikes that mimic automated spam channels.",
              },
              {
                t: "Channel Fleet Management",
                d: "Manage permissions and health status across all your channel handles.",
              },
            ].map((feature, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="shrink-0 mt-0.5 rounded-full bg-primary/10 border border-primary/20 p-0.5 text-primary">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-foreground/90">
                    {feature.t}
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                    {feature.d}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Form Disclaimer */}
          <p className="text-[10px] text-center text-muted-foreground leading-relaxed">
            By signing in, you agree to our{" "}
            <a href="#" className="hover:text-foreground underline">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="hover:text-foreground underline">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
