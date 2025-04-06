// frontend/src/app/(admin)/layout.tsx
"use client";

import { usePathname } from "next/navigation";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import { useEffect } from "react";
import { useLoading } from "@/contexts/LoadingContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin-login";
  const { setDynamicLoading } = useLoading();

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
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-100">
          <PageTransitionWrapper disableLoading={isLoginPage}>
            {children}
          </PageTransitionWrapper>
        </div>
      </ErrorBoundary>
    </AdminAuthProvider>
  );
}