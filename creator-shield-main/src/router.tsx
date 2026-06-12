import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Serve cached data instantly for 60s before considering it stale
        staleTime: 60 * 1000,
        // Keep unused data in cache for 30 minutes
        gcTime: 30 * 60 * 1000,
        // Only retry once on failure — prevents long hangs on bad network
        retry: 1,
        retryDelay: 1000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    // Keep preloaded data fresh for 30s
    defaultPreloadStaleTime: 30 * 1000,
  });

  return router;
};
