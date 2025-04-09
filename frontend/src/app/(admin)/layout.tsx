// frontend/src/app/(admin)/layout.tsx
"use client";

import { usePathname } from "next/navigation";
import { AdminAuthProvider } from "@/contexts/AdminAuthContext";
import PageTransitionWrapper from "@/components/PageTransitionWrapper";
import ErrorBoundary from "@/components/Errors/ErrorBoundary";
import { useEffect, useRef, useState } from "react";
import { useLoading, LoadingStage } from "@/contexts/LoadingContext";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

// Create a wrapper component that will be rendered inside the provider
const AdminLayoutContent = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin-login";
  const { setDynamicLoading, setStage } = useLoading();
  const { isAuthenticated, isAuthChecked } = useAdminAuth();
  const [adminLoaded, setAdminLoaded] = useState(false);

  // Эффект для отслеживания состояния аутентификации
  useEffect(() => {
    // Отмечаем, что админка загружена, когда проверка аутентификации завершена
    if (isAuthChecked) {
      setAdminLoaded(true);
      
      // Если на странице логина, не влияем на стадию загрузки
      if (isLoginPage) {
        return;
      }
      
      // Если пользователь авторизован, устанавливаем стадию COMPLETED
      if (isAuthenticated) {
        setStage(LoadingStage.COMPLETED);
        setDynamicLoading(false);
      } 
      // Если пользователь не авторизован, но мы находимся на странице, требующей авторизацию
      else if (!isAuthenticated && pathname !== "/admin-login") {
        // Устанавливаем STATIC_CONTENT, чтобы разрешить базовую загрузку
        setStage(LoadingStage.STATIC_CONTENT);
      }
    }
  }, [isAuthChecked, isAuthenticated, isLoginPage, pathname, setDynamicLoading, setStage]);

  // Упрощаем обработку административных маршрутов
  useEffect(() => {
    // Устанавливаем флаг для админского маршрута
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('is_admin_route', 'true');
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('is_admin_route');
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <PageTransitionWrapper disableLoading={isLoginPage || adminLoaded}>
        {children}
      </PageTransitionWrapper>
    </div>
  );
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <ErrorBoundary>
        <AdminLayoutContent>
          {children}
        </AdminLayoutContent>
      </ErrorBoundary>
    </AdminAuthProvider>
  );
}