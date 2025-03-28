// frontend/src/app/(admin)/layout.tsx
"use client";

import { usePathname } from "next/navigation";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin-login";

  return (
    <AdminAuthProvider>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <div className="min-h-screen bg-gray-100">
            {!isLoginPage && (
              <p className="text-center text-red-500 py-4">
                {/* Можно оставить пустым или добавить уведомление */}
              </p>
            )}
            <PageTransitionWrapper disableLoading={isLoginPage}>
              {children}
            </PageTransitionWrapper>
          </div>
        </ErrorBoundary>
      </QueryClientProvider>
    </AdminAuthProvider>
  );
}