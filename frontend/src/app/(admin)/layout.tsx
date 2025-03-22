"use client";

import { usePathname } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { ReactNode } from "react";

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { isAdminAuth } = useAdminAuth();
  const pathname = usePathname();

  // Не показываем текст на странице /admin-login
  const isLoginPage = pathname === "/admin-login";

  return (
    <div className="min-h-screen bg-gray-100">
      {!isAdminAuth && !isLoginPage && (
        <p className="text-center text-red-500 py-4">
          Вход только для администраторов
        </p>
      )}
      {children}
    </div>
  );
}