// frontend/src/app/(admin)/layout.tsx
"use client";

import { usePathname } from "next/navigation";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo, useEffect } from "react";
import { useLoading } from "@/contexts/LoadingContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin-login";
  const { setDynamicLoading } = useLoading();

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoginPage) {
        setDynamicLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      setDynamicLoading(false);
    };
  }, [isLoginPage, setDynamicLoading]);

  return (
    <AdminAuthProvider>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <div className="min-h-screen bg-gray-100">
            <PageTransitionWrapper disableLoading={isLoginPage}>
              {children}
            </PageTransitionWrapper>
          </div>
        </ErrorBoundary>
      </QueryClientProvider>
    </AdminAuthProvider>
  );
}