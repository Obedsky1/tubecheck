import { createFileRoute, redirect } from "@tanstack/react-router";

// Redirect /dashboard → /app (the real dashboard route)
export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/app", replace: true });
  },
  component: () => null,
});
