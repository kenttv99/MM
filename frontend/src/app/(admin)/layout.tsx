"use client";

import { usePathname } from "next/navigation";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
// import Breadcrumbs from "@/components/Breadcrumbs";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin-login";

  return (
    <AdminAuthProvider>
      <div className="min-h-screen bg-gray-100">
        {!isLoginPage && (
          <p className="text-center text-red-500 py-4">
            {/* Можно оставить пустым или добавить уведомление */}
          </p>
        )}
        {/* <Breadcrumbs /> */}
        <PageTransitionWrapper disableLoading={isLoginPage}>
          {children}
        </PageTransitionWrapper>
      </div>
    </AdminAuthProvider>
  );
}