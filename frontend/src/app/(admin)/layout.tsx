"use client";

import { usePathname } from "next/navigation";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { PageLoadContext } from "@/contexts/PageLoadContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin-login";
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);

  // Function to set page as loaded
  const setPageLoaded = (loaded: boolean) => {
    setIsPageLoading(!loaded);
    
    // Clear any existing timeout
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      setLoadingTimeout(null);
    }
  };

  // Set a fallback timeout only once on initial mount
  useEffect(() => {
    // No timeout for login page as it doesn't use the loading state
    if (isLoginPage) {
      setIsPageLoading(false);
      return;
    }
    
    const timeout = setTimeout(() => {
      if (isPageLoading) {
        console.log("Admin page load timeout triggered - forcing loading to complete");
        setIsPageLoading(false);
      }
    }, 2000); // 5 second timeout as a safety mechanism
    
    setLoadingTimeout(timeout);
    
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoginPage]);

  return (
    <AdminAuthProvider>
      <QueryClientProvider client={queryClient}>
        <PageLoadContext.Provider value={{ setPageLoaded }}>
          <ErrorBoundary>
            <div className="min-h-screen bg-gray-100">
              {!isLoginPage && (
                <p className="text-center text-red-500 py-4">
                  {/* Можно оставить пустым или добавить уведомление */}
                </p>
              )}
              {isPageLoading && !isLoginPage ? (
                <div className="flex items-center justify-center min-h-screen">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <PageTransitionWrapper disableLoading={isLoginPage}>{children}</PageTransitionWrapper>
              )}
            </div>
          </ErrorBoundary>
        </PageLoadContext.Provider>
      </QueryClientProvider>
    </AdminAuthProvider>
  );
}