import { useAuthContext } from "@/lib/_core/auth-context";

type UseAuthOptions = {
  autoFetch?: boolean;
};

/**
 * Hook to access the global authentication state.
 * All components share the same auth state via AuthContext.
 * This prevents the bug where each component instance fetches the user independently.
 */
export function useAuth(_options?: UseAuthOptions) {
  return useAuthContext();
}
