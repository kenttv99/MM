"use client";

import { usePathname } from "next/navigation";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin-login";
  
  // Create a new query client instance for each request in development
  // In production, share a single client across requests
  const queryClient = useMemo(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  }), []);

  return (
    <AdminAuthProvider>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <div className="min-h-screen bg-gray-100">
            {!isLoginPage && (
              <p className="text-center text-red-500 py-4">
                {/* Placeholder for admin notifications */}
              </p>
            )}
            {/* Используем disableLoading только для страницы логина */}
            <PageTransitionWrapper disableLoading={isLoginPage}>
              {children}
            </PageTransitionWrapper>
          </div>
        </ErrorBoundary>
      </QueryClientProvider>
    </AdminAuthProvider>
  );
}