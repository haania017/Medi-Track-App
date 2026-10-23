import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry(failureCount, error) {
        // Never retry auth/permission/validation failures.
        if (error?.status && error.status < 500) return false;
        return failureCount < 2;
      },
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export default queryClient;
