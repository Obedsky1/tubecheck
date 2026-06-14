import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TubeCheck.live | YouTube Compliance & Monetization Radar" },
      { name: "description", content: "Audit your channel assets, scripts, and video files before publishing. Stop reused content flags, synthetic voice bans, and shadowbans instantly." },
      { name: "author", content: "TubeCheck.live" },
      { name: "theme-color", content: "#0f172a" },
      { property: "og:title", content: "TubeCheck.live | YouTube Compliance & Monetization Radar" },
      { property: "og:description", content: "Audit your channel assets, scripts, and video files before publishing. Stop reused content flags, synthetic voice bans, and shadowbans instantly." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://tubecheck.live" },
      { property: "og:image", content: "https://tubecheck.live/og-image.png" },
      { property: "og:site_name", content: "TubeCheck.live" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "TubeCheck.live | YouTube Compliance & Monetization Radar" },
      { name: "twitter:description", content: "Audit your channel assets, scripts, and video files before publishing. Stop reused content flags, synthetic voice bans, and shadowbans instantly." },
      { name: "twitter:image", content: "https://tubecheck.live/og-image.png" },
      { name: "robots", content: "index, follow" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "shortcut icon", href: "/favicon.ico" },
      { rel: "canonical", href: "https://tubecheck.live" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "TubeCheck.live",
          "url": "https://tubecheck.live",
          "logo": "https://tubecheck.live/logo.png",
          "sameAs": [
            "https://x.com/Youtuberguild"
          ]
        })
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": "TubeCheck.live",
          "url": "https://tubecheck.live",
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "All",
          "potentialAction": [
            {
              "@type": "UseAction",
              "target": "https://tubecheck.live/app/forensics"
            },
            {
              "@type": "UseAction",
              "target": "https://tubecheck.live/app/niche-finder"
            },
            {
              "@type": "ReadAction",
              "target": "https://tubecheck.live/blog"
            }
          ]
        })
      }
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});


function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster position="top-right" theme="dark" richColors />
    </QueryClientProvider>
  );
}
