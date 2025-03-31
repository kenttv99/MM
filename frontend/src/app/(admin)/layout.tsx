// src/app/(admin)/layout.tsx
"use client";

import { usePathname } from "next/navigation";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useEffect } from "react";
import { usePageLoad } from "@/contexts/PageLoadContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin-login";
  const { setPageLoading } = usePageLoad();
  
  // Create a new query client instance for each request in development
  // In production, share a single client across requests
  const queryClient = useMemo(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1, // Reduce retry attempts to prevent cascading requests
      },
    },
  }), []);
  
  // Reset loading state when admin section loads
  useEffect(() => {
    // Short delay to allow components to mount
    const timer = setTimeout(() => {
      if (!isLoginPage) {
        setPageLoading(false);
      }
    }, 300);
    
    return () => {
      clearTimeout(timer);
      setPageLoading(false);
    };
  }, [isLoginPage, setPageLoading]);

  return (
    <AdminAuthProvider>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <div className="min-h-screen bg-gray-100">
            {/* Use disableLoading only for login page */}
            <PageTransitionWrapper disableLoading={isLoginPage}>
              {children}
            </PageTransitionWrapper>
          </div>
        </ErrorBoundary>
      </QueryClientProvider>
    </AdminAuthProvider>
  );
}