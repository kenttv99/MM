"use client";

import { usePathname } from "next/navigation";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import { ReactNode } from "react";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();

  // Не показываем текст на странице /admin-login
  const isLoginPage = pathname === "/admin-login";

  return (
    <AdminAuthProvider>
      <div className="min-h-screen bg-gray-100">
        {!isLoginPage && (
          <p className="text-center text-red-500 py-4">
            
          </p>
        )}
        {children}
      </div>
    </AdminAuthProvider>
  );
}