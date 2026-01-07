import { QueryClient } from '@tanstack/react-query';

// Shared QueryClient instance
// This allows us to clear the cache from the auth store on login/logout
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Clear all cached data - call this on login/logout to ensure
 * no data leaks between user sessions
 */
export function clearQueryCache(): void {
  queryClient.clear();
}
